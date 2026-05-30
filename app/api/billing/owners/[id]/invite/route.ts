export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner, error } = await (supabase as any)
    .from('grazing_owners').select('*').eq('id', id).single()

  if (error || !owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  if (!owner.email)    return NextResponse.json({ error: 'Owner has no email address' }, { status: 400 })

  // Ensure portal_token exists
  let token = owner.portal_token
  if (!token) {
    token = Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('grazing_owners').update({ portal_token: token }).eq('id', id)
  }

  const { data: ranch } = await supabase.from('ranch_settings').select('*').limit(1).maybeSingle()
  const ranchName    = ranch?.ranch_name || 'Brand Book Ranch'
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook.app'
  const portalUrl    = `${appUrl}/owner/${token}`
  const ownerDisplay = owner.company_name || owner.owner_name || owner.name

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:8px;overflow:hidden">
  <div style="background:#111;padding:24px 32px">
    <div style="color:white;font-size:20px;font-weight:700">${ranchName}</div>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:22px;color:#111">You've been invited to the owner portal</h2>
    <p style="color:#555;font-size:14px;line-height:1.7">
      Hello ${ownerDisplay},<br><br>
      ${ranchName} has invited you to access your cattle records and invoices through Brand Book.
      Your portal gives you a secure, read-only view of your animals, invoices, and payment history.
    </p>
    <div style="text-align:center;margin:32px 0">
      <a href="${portalUrl}" style="display:inline-block;background:#ea580c;color:white;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px">ACCESS MY PORTAL</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin-top:8px">
      This link is unique to your account. Do not share it with others.
    </p>
  </div>
</div>
</body></html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: sendError } = await resend.emails.send({
    from:    'Brand Book <noreply@brandbook.app>',
    to:      owner.email,
    subject: `You've been invited to view your cattle records on Brand Book`,
    html,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (sendError) return NextResponse.json({ error: (sendError as any).message ?? 'Email send failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
