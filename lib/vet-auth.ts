// Vet session.
//
// This was broken, not merely dated: it queried vet_invites for a column
// called `token` (the column is `invite_token`) and selected `license_number`,
// which vet_invites does not have at all. Every call errored and returned
// null, so the vet portal could never authenticate anyone.
//
// It now reads the unified portal session. The shape is unchanged so the
// existing vet routes keep compiling, but `id` is the MEMBERSHIP id rather
// than a vet_invites id — the vet works with several outfits, and which ranch
// she is looking at is part of who she is signed in as.

import { getPortalSession } from '@/lib/portal-auth'

export interface VetSession {
  id: string
  name: string
  email: string | null
  practice_name: string | null
  license_number: string | null
  /** Which ranch this session is scoped to. */
  ranch_id?: string
  person_id?: string
  onboarded?: boolean
}

export async function getVetSession(): Promise<VetSession | null> {
  const s = await getPortalSession()
  if (!s || s.role !== 'vet') return null

  return {
    id:             s.membershipId,
    name:           s.displayName,
    email:          s.person.email,
    practice_name:  s.person.practiceName,
    // Deliberately not carried into the session object: the licence belongs on
    // the record being signed, fetched at that moment, not held in every
    // request's session where it would end up logged.
    license_number: null,
    ranch_id:       s.ranchId,
    person_id:      s.personId,
    onboarded:      s.onboarded,
  }
}
