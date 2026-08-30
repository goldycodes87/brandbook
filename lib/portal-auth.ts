// Who is signed in to a portal, and what that lets them do.
//
// Replaces three unrelated answers to the same question: an owner was a
// grazing_owners row with a portal_token, a vet was a vet_invites row matched
// on a column that did not exist, and neither could describe a person who
// works with more than one outfit.
//
// A session is a MEMBERSHIP, not a person and not an owner: person × ranch ×
// role in one id. Switching ranches is picking a different membership, which
// is why the cookie holds this and not a person id.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { signSessionValue, verifySessionValue } from '@/lib/session-cookie'

export const PORTAL_COOKIE = 'brandbook_portal_session'

export type PortalRole = 'admin' | 'co_admin' | 'owner' | 'cpa' | 'vet'

export interface PortalSession {
  membershipId: string
  personId: string
  ranchId: string
  role: PortalRole
  /** Only for role='owner' — the herd this login can see. */
  ownerId: string | null
  onboarded: boolean
  person: {
    firstName: string | null
    lastName: string | null
    preferredName: string | null
    email: string | null
    phone: string | null
    practiceName: string | null
    signatureUrl: string | null
  }
  /** Best name to greet them with. */
  displayName: string
}

type MembershipRow = {
  id: string
  person_id: string
  ranch_id: string
  role: PortalRole
  owner_id: string | null
  status: string
  onboarded_at: string | null
  portal_people: {
    first_name: string | null
    last_name: string | null
    preferred_name: string | null
    email: string | null
    phone: string | null
    practice_name: string | null
    signature_url: string | null
  } | null
}

const SELECT =
  'id, person_id, ranch_id, role, owner_id, status, onboarded_at, ' +
  'portal_people ( first_name, last_name, preferred_name, email, phone, practice_name, signature_url )'

function toSession(row: MembershipRow): PortalSession {
  const p = row.portal_people
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
  return {
    membershipId: row.id,
    personId:     row.person_id,
    ranchId:      row.ranch_id,
    role:         row.role,
    ownerId:      row.owner_id,
    onboarded:    row.onboarded_at != null,
    person: {
      firstName:     p?.first_name ?? null,
      lastName:      p?.last_name ?? null,
      preferredName: p?.preferred_name ?? null,
      email:         p?.email ?? null,
      phone:         p?.phone ?? null,
      practiceName:  p?.practice_name ?? null,
      signatureUrl:  p?.signature_url ?? null,
    },
    displayName: p?.preferred_name || full || p?.email || 'there',
  }
}

/** The signed-in membership, or null. */
export async function getPortalSession(): Promise<PortalSession | null> {
  const jar = await cookies()
  const membershipId = await verifySessionValue(jar.get(PORTAL_COOKIE)?.value)
  if (!membershipId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('portal_memberships')
    .select(SELECT)
    .eq('id', membershipId)
    .eq('status', 'active')
    .maybeSingle()

  // Via `unknown`: the generated types model the portal_people join as an
  // array, but it is many-to-one so PostgREST returns a single object.
  const row = data as unknown as MembershipRow | null
  return row ? toSession(row) : null
}

/** The session, narrowed to one of the allowed roles, or null. */
export async function requireRole(...roles: PortalRole[]): Promise<PortalSession | null> {
  const s = await getPortalSession()
  if (!s) return null
  return roles.includes(s.role) ? s : null
}

/**
 * Redeem a magic-link token.
 *
 * The token is left in place rather than cleared: an owner who bookmarks the
 * link or opens it on a second device would otherwise be locked out with no
 * way back in. What limits it is `expires`, plus the ability to revoke the
 * membership outright.
 */
export async function redeemInvite(token: string): Promise<PortalSession | null> {
  if (!token) return null
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('portal_memberships')
    .select(SELECT + ', invite_expires_at')
    .eq('invite_token', token)
    .neq('status', 'revoked')
    .maybeSingle()

  const row = data as unknown as (MembershipRow & { invite_expires_at: string | null }) | null
  if (!row) return null
  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) return null

  if (row.status !== 'active') {
    await supabase
      .from('portal_memberships')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', row.id)
    row.status = 'active'
  }

  return toSession(row)
}

/** Cookie value for a membership. Ninety days, httpOnly, HMAC-signed. */
export async function portalCookie(membershipId: string) {
  return {
    name:  PORTAL_COOKIE,
    value: await signSessionValue(membershipId),
    options: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge:   60 * 60 * 24 * 90,
      path:     '/',
    },
  }
}

/** Every ranch this person can reach — the vet's ranch switcher. */
export async function membershipsForPerson(personId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('portal_memberships')
    .select('id, role, ranch_id, status, ranch_settings ( ranch_name )')
    .eq('person_id', personId)
    .eq('status', 'active')

  return ((data ?? []) as unknown as Array<{
    id: string; role: PortalRole; ranch_id: string
    ranch_settings: { ranch_name: string | null } | null
  }>).map(m => ({
    membershipId: m.id,
    role:         m.role,
    ranchId:      m.ranch_id,
    ranchName:    m.ranch_settings?.ranch_name ?? 'Ranch',
  }))
}
