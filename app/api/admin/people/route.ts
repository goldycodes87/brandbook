export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import type { PortalRole } from '@/lib/portal-auth'

/**
 * Everyone with a way in, and what each one can reach.
 *
 * Built on portal_memberships rather than moved from Settings → Users, which
 * is the one exception to moving panels across unchanged. That panel invited
 * people by inserting into `profiles` with a random uuid — and profiles.id is
 * a foreign key to auth.users, so every invite failed with a 23503 and the
 * feature had never worked. Moving it would have preserved nothing.
 */

const ROLE_LABEL: Record<PortalRole, string> = {
  admin:    'Admin',
  co_admin: 'Ranch Manager',
  owner:    'Owner',
  cpa:      'CPA',
  vet:      'Veterinarian',
}

const INVITABLE: PortalRole[] = ['co_admin', 'cpa', 'vet', 'admin']

export async function GET() {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('portal_memberships')
    .select(`
      id, role, status, invited_at, accepted_at, onboarded_at, invite_token, owner_id,
      portal_people ( id, first_name, last_name, preferred_name, email, phone, practice_name, auth_user_id ),
      grazing_owners ( id, name, company_name, owner_name )
    `)
    .eq('ranch_id', s.ranchId ?? '')
    .neq('status', 'revoked')
    .order('invited_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as Array<{
    id: string; role: PortalRole; status: string
    invited_at: string; accepted_at: string | null; onboarded_at: string | null
    invite_token: string | null; owner_id: string | null
    portal_people: { id: string; first_name: string | null; last_name: string | null
                     preferred_name: string | null; email: string | null; phone: string | null
                     practice_name: string | null; auth_user_id: string | null } | null
    grazing_owners: { name: string | null; company_name: string | null; owner_name: string | null } | null
  }>

  return NextResponse.json({
    data: rows.map(r => ({
      id:        r.id,
      role:      r.role,
      roleLabel: ROLE_LABEL[r.role] ?? r.role,
      status:    r.status,
      name:      r.portal_people?.preferred_name
                 || [r.portal_people?.first_name, r.portal_people?.last_name].filter(Boolean).join(' ')
                 || r.portal_people?.email
                 || 'Unnamed',
      email:     r.portal_people?.email ?? null,
      phone:     r.portal_people?.phone ?? null,
      practice:  r.portal_people?.practice_name ?? null,
      // A password login and a magic link are different doors; the room should
      // say which one this person has.
      hasPassword: Boolean(r.portal_people?.auth_user_id),
      herd:      r.grazing_owners?.company_name || r.grazing_owners?.owner_name || r.grazing_owners?.name || null,
      accepted:  r.accepted_at != null,
      onboarded: r.onboarded_at != null,
      // Shown until somebody has actually FINISHED onboarding, not merely
      // until accepted_at is set. Andy and Doug were marked accepted by the
      // migration that seeded their memberships — neither has ever opened the
      // app — so keying on accepted_at hid the one link an operator needed to
      // send them.
      inviteToken: r.onboarded_at ? null : r.invite_token,
    })),
    // Whether the ranch is even set up to have owners.
    roles: INVITABLE.map(r => ({ value: r, label: ROLE_LABEL[r] })),
  })
}

// POST — invite somebody. Creates the person if they are new, then the
// membership carrying the token that is their way in.
export async function POST(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!s.ranchId) return NextResponse.json({ error: 'No ranch configured' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role  = body.role as PortalRole

  if (!email)                    return NextResponse.json({ error: 'An email address is required' }, { status: 400 })
  if (!INVITABLE.includes(role)) return NextResponse.json({ error: 'Pick a role' }, { status: 400 })
  // Owner memberships are created alongside a herd in the Owners room; one
  // made here would have no owner_id and fail the table's own check.
  if (role === 'owner')          return NextResponse.json({ error: 'Invite owners from the Owners room' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('portal_people').select('id').ilike('email', email).maybeSingle()

  let personId = (existing as { id: string } | null)?.id ?? null

  if (!personId) {
    const { data: created, error } = await supabase
      .from('portal_people')
      .insert({
        email,
        first_name:    typeof body.first_name === 'string' ? body.first_name.trim() || null : null,
        last_name:     typeof body.last_name  === 'string' ? body.last_name.trim()  || null : null,
        practice_name: typeof body.practice_name === 'string' ? body.practice_name.trim() || null : null,
      })
      .select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    personId = (created as { id: string }).id
  }

  const token = randomUUID()
  const expires = new Date(); expires.setDate(expires.getDate() + 30)

  // Re-inviting the same person in the same role refreshes their link rather
  // than creating a second way in.
  const { data: membership, error: memErr } = await supabase
    .from('portal_memberships')
    .upsert({
      person_id: personId,
      ranch_id:  s.ranchId,
      role,
      status:    'invited',
      invite_token: token,
      invite_expires_at: expires.toISOString(),
      invited_at: new Date().toISOString(),
    }, { onConflict: 'person_id,ranch_id,role' })
    .select('id, invite_token')
    .single()

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  const m = membership as { id: string; invite_token: string }
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'

  return NextResponse.json({
    ok: true,
    membershipId: m.id,
    // Returned rather than only emailed: email delivery is the part most
    // likely to fail silently, and an operator who can read the link out loud
    // is never blocked by it.
    inviteUrl: `${base}/welcome/${m.invite_token}`,
  }, { status: 201 })
}
