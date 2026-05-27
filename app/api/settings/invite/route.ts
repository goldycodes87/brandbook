export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email, name, role } = await req.json()
  if (!email || !role) return NextResponse.json({ error: 'email and role required' }, { status: 400 })

  const supabase = createAdminClient()
  const token = crypto.randomUUID()

  // Fetch ranch name for email copy
  const { data: ranch } = await supabase
    .from('ranch_settings')
    .select('ranch_name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const ranchName = ranch?.ranch_name || 'Brand Book'

  // Create profile record
  const { error: insertError } = await supabase.from('profiles').insert({
    id: crypto.randomUUID(),
    email,
    name: name || '',
    role,
    invite_token: token,
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'
  const inviteUrl = `${appUrl}/invite/${token}`
  const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const from = process.env.RESEND_FROM_EMAIL || 'Brand Book <onboarding@resend.dev>'

  const { error: emailError } = await resend.emails.send({
    from,
    to: email,
    subject: "You've been invited to Brand Book",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;padding:0 16px">
    <div style="margin-bottom:32px">
      <span style="font-size:28px;font-weight:700;color:#f97316;letter-spacing:-0.02em">BRAND</span><span style="font-size:28px;font-weight:400;color:#f9fafb;letter-spacing:-0.02em">BOOK</span>
    </div>
    <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px">
      <p style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px">Invitation</p>
      <h1 style="color:#f9fafb;font-size:22px;font-weight:600;margin:0 0 16px;line-height:1.3">
        ${ranchName} has invited you to join Brand Book as a ${roleLabel}.
      </h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;line-height:1.6">
        Brand Book is a ranch management platform. Click the button below to set up your account and get started.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;letter-spacing:0.04em">
        ACCEPT INVITATION
      </a>
      <p style="color:#374151;font-size:12px;margin:24px 0 0;line-height:1.5">
        This invite expires in 7 days. If you didn't expect this, ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`,
  })

  if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
