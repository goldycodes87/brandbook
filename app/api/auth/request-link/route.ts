export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOperatorLinkEmail } from '@/lib/emails'

/**
 * "I cannot remember my password."
 *
 * Emails a one-time link that returns an operator to the account they already
 * have. It cannot create an account and it cannot change a role: redemption
 * looks up an auth user that already exists, and the cookie it eventually sets
 * is that user's own id. The worst this can do is let somebody who controls
 * the inbox into the account that inbox already owns — which is exactly what a
 * password reset email does, with one less screen.
 *
 * Same answer whether or not the address is on file, for the same reason as
 * the portal version: otherwise it is a way to enumerate who works here.
 */

const LINK_MINUTES = 20

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  const same = NextResponse.json({
    ok: true,
    message: 'If that address can sign in here, the link is on its way.',
  })

  if (!email || !email.includes('@')) return same

  const supabase = createAdminClient()

  // The person must already have a real login. This route hands one back; it
  // never mints one.
  const { data: personRow } = await supabase
    .from('portal_people')
    .select('id, first_name, preferred_name, email, auth_user_id')
    .ilike('email', email)
    .not('auth_user_id', 'is', null)
    .maybeSingle()

  const person = personRow as {
    id: string; first_name: string | null; preferred_name: string | null
    email: string | null; auth_user_id: string | null
  } | null

  if (!person?.auth_user_id) return same

  const token   = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  const expires = new Date(Date.now() + LINK_MINUTES * 60_000)

  const { error } = await supabase.from('auth_signin_tokens').insert({
    token,
    auth_user_id: person.auth_user_id,
    requested_for: email,
    expires_at: expires.toISOString(),
  })
  if (error) return same

  const { data: ranchRow } = await supabase
    .from('ranch_settings').select('ranch_name').limit(1).maybeSingle()
  const ranchName = (ranchRow as { ranch_name: string | null } | null)?.ranch_name?.trim() || 'The ranch'

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'

  await sendOperatorLinkEmail(person.email ?? email, {
    ranchName,
    personName: person.preferred_name || person.first_name || '',
    url: `${base}/signin/${token}`,
    minutes: LINK_MINUTES,
  })

  return same
}
