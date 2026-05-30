export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error } = await (supabase as any)
    .from('invoices')
    .select('*, owner:grazing_owners(*)')
    .eq('id', id)
    .single()

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const owner = invoice.owner
  if (!owner?.email)  return NextResponse.json({ error: 'Owner has no email address' }, { status: 400 })

  const { data: ranch } = await supabase.from('ranch_settings').select('*').limit(1).maybeSingle()
  const ranchName = ranch?.ranch_name || 'Brand Book Ranch'

  const token   = owner.portal_token
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook.app'
  const portalUrl = token ? `${appUrl}/owner/${token}` : appUrl

  const fmtDate  = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
  const fmtMoney = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const lineRows = (invoice.line_items ?? []).map((li: { description: string; amount: number }) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${li.description}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${fmtMoney(li.amount)}</td></tr>`
  ).join('')

  const expRows = (invoice.expense_splits ?? []).map((e: { description: string; owner_amount: number }) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${e.description}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${fmtMoney(e.owner_amount)}</td></tr>`
  ).join('')

  const ownerDisplay = owner.company_name || owner.owner_name || owner.name

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden">
  <div style="background:#111;padding:24px 32px;display:flex;align-items:center;justify-content:space-between">
    <div style="color:white;font-size:22px;font-weight:700">${ranchName}</div>
    <div style="color:#ea580c;font-size:12px;font-weight:700;letter-spacing:2px">INVOICE</div>
  </div>
  <div style="padding:32px">
    <table style="width:100%;margin-bottom:24px"><tr>
      <td style="vertical-align:top">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#999;font-weight:700">BILLED TO</p>
        <p style="margin:0;font-weight:600;font-size:15px">${ownerDisplay}</p>
        ${owner.email ? `<p style="margin:4px 0 0;font-size:13px;color:#666">${owner.email}</p>` : ''}
        ${owner.phone ? `<p style="margin:2px 0 0;font-size:13px;color:#666">${owner.phone}</p>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <p style="margin:0 0 4px;font-size:13px;font-family:monospace;color:#666">${invoice.invoice_number}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#666">Period: ${fmtDate(invoice.period_start)} – ${fmtDate(invoice.period_end)}</p>
        ${invoice.due_date ? `<p style="margin:0;font-size:13px;color:#e53e3e;font-weight:600">Due: ${fmtDate(invoice.due_date)}</p>` : ''}
      </td>
    </tr></table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead><tr style="background:#f9f9f9">
        <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#999;border-bottom:2px solid #eee">Description</th>
        <th style="padding:10px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#999;border-bottom:2px solid #eee">Amount</th>
      </tr></thead>
      <tbody>
        ${lineRows}${expRows}
        <tr>
          <td style="padding:16px 8px 4px;font-weight:700;font-size:15px;border-top:2px solid #111">TOTAL DUE</td>
          <td style="padding:16px 8px 4px;text-align:right;font-weight:700;font-size:20px;color:#ea580c;border-top:2px solid #111">${fmtMoney(invoice.total_amount)}</td>
        </tr>
      </tbody>
    </table>
    ${invoice.notes ? `<p style="color:#666;font-size:13px;margin-top:16px">Notes: ${invoice.notes}</p>` : ''}
    <div style="text-align:center;margin-top:32px">
      <a href="${portalUrl}" style="display:inline-block;background:#ea580c;color:white;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px">VIEW INVOICE</a>
    </div>
    ${ranch?.email || ranch?.phone ? `<p style="color:#999;font-size:12px;text-align:center;margin-top:24px">Questions? Contact us${ranch.phone ? ` at ${ranch.phone}` : ''}${ranch.email ? ` · ${ranch.email}` : ''}</p>` : ''}
  </div>
</div>
</body></html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: sendError } = await resend.emails.send({
    from: 'Brand Book <noreply@brandbook.app>',
    to:   owner.email,
    subject: `Invoice ${invoice.invoice_number} from ${ranchName}`,
    html,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (sendError) return NextResponse.json({ error: (sendError as any).message ?? 'Email send failed' }, { status: 500 })

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('invoices').update({
    status:         'sent',
    sent_at:        now,
    email_sent_at:  now,
  }).eq('id', id)

  return NextResponse.json({ ok: true })
}
