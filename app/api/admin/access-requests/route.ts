export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import { sendInviteEmail } from '@/lib/emails'

/**
 * Owners asking for somebody else to be let in.
 *
 * Lives beside People & Roles because that is where access is decided, and
 * because a request nobody ever sees is worse than no request at all — it
 * looks answered to the person who sent it. Owner buy and sell requests still
 * have no operator screen anywhere; this one does.
 *
 * GET  — what is waiting.
 * POST — approve one, which creates the membership and sends the invite, or
 *        decline it.
 */

export async function GET() {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('owner_requests')
    .select('id, owner_id, status, access_name, access_email, notes, created_at')
    .eq('request_type', 'access')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Array<{
    id: string; owner_id: string; status: string
    access_name: string | null; access_email: string | null
    notes: string | null; created_at: string
  }>

  if (rows.length === 0) return NextResponse.json({ data: [] })

  const { data: owners } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name')
    .in('id', rows.map(r => r.owner_id))

  const herdName = new Map(
    ((owners ?? []) as Array<{ id: string; name: string | null; company_name: string | null; owner_name: string | null }>)
      .map(o => [o.id, o.company_name || o.owner_name || o.name || 'Unnamed herd']),
  )

  return NextResponse.json({
    data: rows.map(r => ({
      id: r.id,
      ownerId: r.owner_id,
      herd: herdName.get(r.owner_id) ?? 'Unknown herd',
      name: r.access_name,
      email: r.access_email,
      notes: r.notes,
      askedAt: r.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!s.ranchId) return NextResponse.json({ error: 'No ranch configured' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const decision = body.decision === 'approve' ? 'approve' : 'decline'
  if (!id) return NextResponse.json({ error: 'Which request?' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: reqRow } = await supabase
    .from('owner_requests')
    .select('id, owner_id, request_type, status, access_name, access_email')
    .eq('id', id)
    .maybeSingle()

  const request = reqRow as {
    id: string; owner_id: string; request_type: string; status: string
    access_name: string | null; access_email: string | null
  } | null

  if (!request || request.request_type !== 'access') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'That one has already been dealt with' }, { status: 409 })
  }

  if (decision === 'decline') {
    await supabase.from('owner_requests')
      .update({ status: 'declined', rancher_notes: typeof body.note === 'string' ? body.note : null })
      .eq('id', id)
    return NextResponse.json({ ok: true, decision: 'declined' })
  }

  // ── Approve: the same path the invite form takes, so there is one way an
  //    owner membership comes into being rather than two that can drift.
  const email = (request.access_email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'That request has no email address on it' }, { status: 400 })

  const { data: existing } = await supabase
    .from('portal_people').select('id').ilike('email', email).maybeSingle()

  let personId = (existing as { id: string } | null)?.id ?? null
  if (!personId) {
    const [first, ...rest] = (request.access_name ?? '').trim().split(/\s+/)
    const { data: created, error } = await supabase
      .from('portal_people')
      .insert({ email, first_name: first || null, last_name: rest.join(' ') || null })
      .select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    personId = (created as { id: string }).id
  }

  const token = randomUUID()
  const expires = new Date(); expires.setDate(expires.getDate() + 30)

  const { data: membership, error: memErr } = await supabase
    .from('portal_memberships')
    .upsert({
      person_id: personId,
      ranch_id: s.ranchId,
      role: 'owner',
      owner_id: request.owner_id,
      status: 'invited',
      invite_token: token,
      invite_expires_at: expires.toISOString(),
      invited_at: new Date().toISOString(),
    }, { onConflict: 'person_id,ranch_id,role' })
    .select('id, invite_token')
    .single()

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  const m = membership as { id: string; invite_token: string }
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'
  const inviteUrl = `${base}/welcome/${m.invite_token}`

  const { data: ranchRow } = await supabase
    .from('ranch_settings').select('ranch_name').limit(1).maybeSingle()

  const sent = await sendInviteEmail(email, {
    ranchName: (ranchRow as { ranch_name: string | null } | null)?.ranch_name?.trim() || 'The ranch',
    inviterName: s.name,
    personName: (request.access_name ?? '').trim().split(/\s+/)[0] ?? '',
    role: 'owner',
    url: inviteUrl,
  })

  // Marked completed and pointed at what it became, so the request stops
  // asking and an operator can see which membership answered it.
  await supabase.from('owner_requests')
    .update({ status: 'completed', resolved_membership_id: m.id })
    .eq('id', id)

  return NextResponse.json({
    ok: true,
    decision: 'approved',
    inviteUrl,
    emailed: sent.ok,
    emailError: sent.ok ? undefined : sent.error,
  })
}
