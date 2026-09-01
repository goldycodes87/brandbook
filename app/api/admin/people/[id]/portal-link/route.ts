export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

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

  const from = process.env.RESEND_FROM_EMAIL || `BrandBook <noreply@brandbook.app>`
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { error } = await resend.emails.send({
    from,
    to: result.email,
    subject: `Your ${ranchName} portal link`,
    // Plain and short on purpose: an access link that reads like marketing is
    // the one people delete, and the one that trips a spam filter.
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111;line-height:1.6">
  <p>${result.name},</p>
  <p>Here is your link to the ${ranchName} portal. It signs you in — there is no password to remember.</p>
  <p><a href="${result.url}" style="color:#ea580c">${result.url}</a></p>
  <p style="color:#666;font-size:13px">Keep it to yourself: anybody with this link can see your cattle records.</p>
</body></html>`,
  })

  if (error) {
    const message = (error as { message?: string }).message ?? 'That email did not send'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true, sentTo: result.email })
}
