// What the person holding the operator password is allowed to do.
//
// Two ways into BrandBook and both are real: operators sign in with a password
// (brandbook_session holds a Supabase auth.users id), portal people sign in
// with a magic link and have no auth account. What they share is the role,
// via portal_people.auth_user_id.
//
// Resolution order is deliberate:
//   1. a portal membership for this auth user — the finer, per-ranch answer
//   2. profiles.role — the coarse legacy fallback, so an operator who has not
//      been linked to a person yet is not locked out of their own ranch
//
// Falling back rather than failing closed is the right call HERE and only
// here: this is the operator's own installation, they already proved a
// password, and the alternative is a ranch owner shut out of their records by
// a migration. Portal routes fail closed, because there the token is the only
// claim.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySessionValue } from '@/lib/session-cookie'
import type { PortalRole } from '@/lib/portal-auth'

export interface AdminSession {
  authUserId: string
  personId: string | null
  ranchId: string | null
  role: PortalRole
  name: string
  email: string | null
  /** Import, export and cleanup. Admin only — these can destroy the herd record. */
  canManageData: boolean
  /** Everything except Data. */
  canConfigure: boolean
  /** Rates, invoices and the tax reports, read-only for a CPA. */
  canSeeBilling: boolean
}

const ADMIN_ROLES: PortalRole[] = ['admin', 'co_admin']

/** The signed-in operator and what their role permits, or null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies()
  const authUserId = await verifySessionValue(jar.get('brandbook_session')?.value)
  if (!authUserId) return null

  const supabase = createAdminClient()

  const { data: personRow } = await supabase
    .from('portal_people')
    .select('id, first_name, last_name, preferred_name, email, portal_memberships ( id, role, ranch_id, status )')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  // Via `unknown`: the generated types model the memberships join as an array,
  // which here it genuinely is — one person, several ranches.
  const person = personRow as unknown as {
    id: string; first_name: string | null; last_name: string | null
    preferred_name: string | null; email: string | null
    portal_memberships: Array<{ id: string; role: PortalRole; ranch_id: string; status: string }>
  } | null

  if (person) {
    const active = person.portal_memberships.filter(m => m.status === 'active')
    // Most privileged wins: someone who is admin at their own place and a CPA
    // elsewhere is still an admin here.
    const best =
      active.find(m => m.role === 'admin') ??
      active.find(m => m.role === 'co_admin') ??
      active.find(m => m.role === 'cpa') ??
      active[0]

    if (best) {
      return {
        authUserId,
        personId: person.id,
        ranchId:  best.ranch_id,
        role:     best.role,
        name:     person.preferred_name
                  || [person.first_name, person.last_name].filter(Boolean).join(' ')
                  || person.email
                  || 'Operator',
        email:    person.email,
        canManageData: best.role === 'admin',
        canConfigure:  ADMIN_ROLES.includes(best.role),
        canSeeBilling: ADMIN_ROLES.includes(best.role) || best.role === 'cpa',
      }
    }
  }

  // Legacy fallback.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, role, name, email')
    .eq('id', authUserId)
    .maybeSingle()

  const profile = profileRow as { id: string; role: string; name: string | null; email: string | null } | null
  if (!profile || profile.role !== 'operator') return null

  const { data: ranch } = await supabase.from('ranch_settings').select('id').limit(1).maybeSingle()

  return {
    authUserId,
    personId: null,
    ranchId:  (ranch as { id: string } | null)?.id ?? null,
    role:     'admin',
    name:     profile.name ?? 'Operator',
    email:    profile.email,
    canManageData: true,
    canConfigure:  true,
    canSeeBilling: true,
  }
}

/** True when this session should be offered the Admin section at all. */
export async function canReachAdmin(): Promise<boolean> {
  const s = await getAdminSession()
  return Boolean(s && (s.canConfigure || s.canSeeBilling))
}
