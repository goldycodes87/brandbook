export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import { sendPortalLinkEmail } from '@/lib/emails'

type Params = { params: Promise<{ id: string }> }

/**
 * The one way somebody gets into the portal.
 *
 * There used to be two. People & Roles showed a /welcome/ link that runs the
 * onboarding; the Owners room had a PORTAL INVITE button that emailed a
 * /owner/{portal_token} link straight into the read-only portal, skipping
 * onboarding altogether. Which button an operator happened to press decided
 * what the owner saw on their first visit. That button is gone.
 *
 * GET  — the current link, minting one if the membership has none.
 * POST — the same link, emailed to them.
 */

async function linkFor(id: string, ranchId: string | null) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('portal_memberships')
    .select('id, ranch_id, invite_token, status, portal_people ( first_name, preferred_name, email )')
    .eq('id', id)
    .maybeSingle()

  // Via `unknown`: PostgREST models the to-one join as an array.
  const row = data as unknown as {
    id: string; ranch_id: string; invite_token: string | null; status: string
    portal_people: { first_name: string | null; preferred_name: string | null; email: string | null } | null
  } | null

  if (!row || row.ranch_id !== ranchId) return { error: 'Not found', status: 404 as const }
  if (row.status === 'revoked') return { error: 'That person no longer has access', status: 409 as const }

  let token = row.invite_token
  if (!token) {
    // A membership seeded without one, or a link deliberately rotated away.
    token = randomUUID()
    const { error } = await supabase
      .from('portal_memberships').update({ invite_token: token }).eq('id', id)
    if (error) return { error: error.message, status: 500 as const }
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'
  return {
    url: `${base}/welcome/${token}`,
    email: row.portal_people?.email ?? null,
    name: row.portal_people?.preferred_name || row.portal_people?.first_name || 'there',
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await linkFor(id, s.ranchId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await linkFor(id, s.ranchId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  if (!result.email) {
    return NextResponse.json({ error: 'No email address on file — add one first, or copy the link and send it yourself' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: ranchRow } = await supabase
    .from('ranch_settings').select('ranch_name').limit(1).maybeSingle()
  const ranchName = (ranchRow as { ranch_name: string | null } | null)?.ranch_name?.trim() || 'the ranch'

  const sent = await sendPortalLinkEmail(result.email, {
    ranchName,
    personName: result.name === 'there' ? '' : result.name,
    url: result.url,
  })

  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 })

  return NextResponse.json({ ok: true, sentTo: result.email })
}
