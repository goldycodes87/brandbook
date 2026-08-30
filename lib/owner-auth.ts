// Owner session — now a thin view over the unified portal session.
//
// The contract is unchanged on purpose: eleven routes read `session.id` as a
// grazing_owners id, so that is still what comes back. What changed is where
// it comes from, and that an owner is now a person holding an owner
// membership rather than a row with a token stapled to it.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySessionValue } from '@/lib/session-cookie'
import { getPortalSession } from '@/lib/portal-auth'

export interface OwnerSession {
  id: string          // grazing_owners.id — unchanged
  name: string
  membershipId?: string
  personId?: string
  onboarded?: boolean
}

const LEGACY_COOKIE = 'brandbook_owner_session'

export async function getOwnerSession(): Promise<OwnerSession | null> {
  // Preferred path.
  const portal = await getPortalSession()
  if (portal?.role === 'owner' && portal.ownerId) {
    return {
      id:           portal.ownerId,
      name:         portal.displayName,
      membershipId: portal.membershipId,
      personId:     portal.personId,
      onboarded:    portal.onboarded,
    }
  }

  // Legacy cookie. Owners signed in before the change hold a signed
  // grazing_owners id; expiring them all to ship a refactor would be a poor
  // trade. Kept until the cookie's own 90 days run out.
  const jar = await cookies()
  const ownerId = await verifySessionValue(jar.get(LEGACY_COOKIE)?.value)
  if (!ownerId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name')
    .eq('id', ownerId)
    .maybeSingle()

  if (!data) return null
  const o = data as { id: string; name: string | null; company_name: string | null; owner_name: string | null }

  // Carry the membership through when one exists, so callers that need
  // onboarding state get it even on a legacy cookie.
  const { data: m } = await supabase
    .from('portal_memberships')
    .select('id, person_id, onboarded_at')
    .eq('owner_id', ownerId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle()

  const mem = m as { id: string; person_id: string; onboarded_at: string | null } | null

  return {
    id:           o.id,
    name:         o.company_name || o.owner_name || o.name || 'Owner',
    membershipId: mem?.id,
    personId:     mem?.person_id,
    onboarded:    mem ? mem.onboarded_at != null : undefined,
  }
}
