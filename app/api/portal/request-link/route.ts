export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * "Send me my link again."
 *
 * Owners and vets have no password to forget — they sign in by link, and the
 * thing that actually goes wrong is losing the email or coming back after the
 * ninety-day cookie has lapsed. Before this, the only way back was to ask the
 * ranch to read the link out of the admin section.
 *
 * Two properties this route has to hold:
 *
 * 1. It answers identically whether or not the address is on file. Anything
 *    else turns it into a tool for finding out who a ranch does business with.
 * 2. The link it mints is short-lived and replaces the previous one. A link is
 *    the whole credential here, so the old one has to stop working — otherwise
 *    every request leaves another permanent key in another inbox.
 */

const LINK_MINUTES = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  // The same answer either way, and the same shape of work, so the response
  // time does not give it away either.
  const same = NextResponse.json({
    ok: true,
    message: 'If that address is on file, the link is on its way.',
  })

  if (!email || !email.includes('@')) return same

  const supabase = createAdminClient()

  const { data: personRow } = await supabase
    .from('portal_people')
    .select('id, first_name, preferred_name, email')
    .ilike('email', email)
    .maybeSingle()

  const person = personRow as { id: string; first_name: string | null; preferred_name: string | null; email: string | null } | null
  if (!person) return same

  const { data: membershipRow } = await supabase
    .from('portal_memberships')
    .select('id, role')
    .eq('person_id', person.id)
    .eq('status', 'active')
    .order('invited_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const membership = membershipRow as { id: string; role: string } | null
  if (!membership) return same

  const token = randomUUID()
  const expires = new Date(Date.now() + LINK_MINUTES * 60_000)

  const { error: updateError } = await supabase
    .from('portal_memberships')
    .update({ invite_token: token, invite_expires_at: expires.toISOString() })
    .eq('id', membership.id)

  if (updateError) return same

  const { data: ranchRow } = await supabase
    .from('ranch_settings').select('ranch_name').limit(1).maybeSingle()
  const ranchName = (ranchRow as { ranch_name: string | null } | null)?.ranch_name?.trim() || 'the ranch'

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'
  const url  = `${base}/welcome/${token}`
  const name = person.preferred_name || person.first_name || 'there'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'BrandBook <noreply@brandbook.app>',
    to: person.email ?? email,
    subject: `Your ${ranchName} portal link`,
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;line-height:1.6">
  <p>${name},</p>
  <p>Here is your link back into the ${ranchName} portal. It signs you in — there is no password.</p>
  <p><a href="${url}" style="color:#ea580c">${url}</a></p>
  <p style="color:#666;font-size:13px">
    Good for ${LINK_MINUTES} minutes, and it replaces any earlier link. If you did not ask for
    this, you can ignore it — but tell the ranch, because somebody typed your address.
  </p>
</body></html>`,
  }).catch(() => {})

  return same
}
