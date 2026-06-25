export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { generateInvoicePdfBuffer } from '@/lib/generate-invoice-pdf'

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
  if (!owner?.email) return NextResponse.json({ error: 'Owner has no email address' }, { status: 400 })

  const { data: ranch } = await supabase.from('ranch_settings').select('*').limit(1).maybeSingle()
  const ranchName  = ranch?.ranch_name  || 'Legacy Land & Cattle'
  const logoUrl    = ranch?.logo_url    || ''
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'

  const fmtMoney = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate  = (d: string | null) => d
    ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Upon Receipt'

  const ownerFirstName = (owner.owner_name || owner.name || 'there').split(' ')[0]
  const ownerDisplay   = owner.company_name || owner.owner_name || owner.name || 'Customer'
  const baseAmount     = Number(invoice.total_amount)
  const surcharge      = Math.round(baseAmount * 0.03 * 100) / 100
  const totalWithFee   = Math.round((baseAmount + surcharge) * 100) / 100

  // ── Square payment link ───────────────────────────────────────────────────
  let paymentUrl: string | null = invoice.square_payment_link || null

  if (!paymentUrl && process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SquareClient, SquareEnvironment } = require('square') as {
        SquareClient: new (opts: { token: string; environment: string }) => {
          checkout: { paymentLinks: { create: (b: unknown) => Promise<{ paymentLink?: { url?: string } }> } }
        }
        SquareEnvironment: { Production: string; Sandbox: string }
      }
      const sqClient = new SquareClient({
        token:       process.env.SQUARE_ACCESS_TOKEN,
        environment: process.env.SQUARE_ENVIRONMENT === 'production'
          ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
      })
      // Include 3% card fee in link total
      const totalCents = BigInt(Math.round(totalWithFee * 100))
      const result = await sqClient.checkout.paymentLinks.create({
        idempotencyKey: `send-${id}-${Date.now()}`,
        quickPay: {
          name:       `Invoice ${invoice.invoice_number} — ${ownerDisplay}`,
          priceMoney: { amount: totalCents, currency: 'USD' },
          locationId: process.env.SQUARE_LOCATION_ID,
        },
      })
      if (result.paymentLink?.url) paymentUrl = result.paymentLink.url
    } catch { /* non-fatal */ }
  }

  // ── Build line items HTML ─────────────────────────────────────────────────
  type LI = { description: string; amount: number; is_header?: boolean; share_note?: string }
  const lineItems = (invoice.line_items ?? []) as LI[]

  const lineItemRows = lineItems.map((item: LI) => {
    if (item.is_header) {
      return `<tr><td colspan="2" style="padding:10px 12px 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#ea580c;border-top:1px solid #fde8d8;background:#fff8f5">${item.description}</td></tr>`
    }
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px">
        ${item.description}
        ${item.share_note ? `<br><span style="font-size:11px;color:#999">${item.share_note}</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap">
        ${fmtMoney(Number(item.amount))}
      </td>
    </tr>`
  }).join('')

  // ── Branded email HTML ────────────────────────────────────────────────────
  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:600px;margin:0 auto;background:white">

  <!-- HEADER -->
  <div style="background:#1a1a1a;padding:32px 40px;text-align:center">
    ${logoUrl
      ? `<img src="${logoUrl}" style="height:60px" alt="${ranchName}">`
      : `<div style="color:white;font-size:20px;font-weight:900;letter-spacing:-0.5px">${ranchName}</div>`}
  </div>

  <!-- HERO -->
  <div style="background:#1a1a1a;padding:24px 40px 40px;text-align:center;border-bottom:3px solid #ea580c">
    <div style="color:#ea580c;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">
      Invoice #${invoice.invoice_number}
    </div>
    <div style="color:white;font-size:48px;font-weight:900;letter-spacing:-2px">
      ${fmtMoney(baseAmount)}
    </div>
    <div style="color:#999;font-size:14px;margin-top:8px">
      Due ${fmtDate(invoice.due_date)}
    </div>
  </div>

  <!-- BODY -->
  <div style="padding:40px">
    <p style="font-size:16px;margin:0 0 16px;color:#333">Hi ${ownerFirstName},</p>
    <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 24px">
      Please find your grazing invoice attached as a PDF. A summary is below.
    </p>

    <!-- LINE ITEMS -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px">
      <thead>
        <tr>
          <th style="background:#f5f5f5;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666">Description</th>
          <th style="background:#f5f5f5;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
        <tr>
          <td style="padding:14px 12px 10px;font-weight:700;font-size:16px;border-top:2px solid #1a1a1a">Total Due</td>
          <td style="padding:14px 12px 10px;font-weight:700;font-size:16px;text-align:right;border-top:2px solid #1a1a1a">${fmtMoney(baseAmount)}</td>
        </tr>
      </tbody>
    </table>

    <!-- PAY ONLINE -->
    ${paymentUrl ? `
    <a href="${paymentUrl}" style="display:block;background:#ea580c;color:white;text-decoration:none;text-align:center;padding:16px 32px;border-radius:8px;font-weight:700;font-size:16px;margin:0 0 12px;letter-spacing:0.5px">
      PAY ONLINE →
    </a>
    <p style="text-align:center;font-size:12px;color:#999;margin:0 0 32px">
      A 3% card processing fee applies to online payments. Total with fee: ${fmtMoney(totalWithFee)}
    </p>
    ` : ''}

    <!-- PAY BY CHECK -->
    <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:0 0 24px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:12px;font-weight:600">Pay by Check</div>
      <div style="font-size:14px;color:#333;line-height:1.8">
        Make check payable to:<br>
        <strong>${ranchName}</strong><br>
        ${ranch?.address ? ranch.address + '<br>' : ''}
        ${[ranch?.city, ranch?.state, ranch?.zip].filter(Boolean).join(', ')}
      </div>
    </div>

    <p style="font-size:14px;color:#555;margin:0">
      Questions? Reply to this email${ranch?.phone ? ` or call ${ranch.phone}` : ''}.
    </p>

    <!-- VIEW PORTAL -->
    ${owner.portal_token ? `
    <div style="text-align:center;margin-top:24px">
      <a href="${appUrl}/owner/${owner.portal_token}" style="font-size:13px;color:#ea580c;text-decoration:none">
        View your owner portal →
      </a>
    </div>
    ` : ''}
  </div>

  <!-- FOOTER -->
  <div style="background:#1a1a1a;padding:32px 40px;text-align:center;color:#666;font-size:12px">
    <p style="margin:0 0 8px">${ranchName}${ranch?.address ? `<br>${ranch.address} · ${[ranch?.city, ranch?.state, ranch?.zip].filter(Boolean).join(', ')}` : ''}</p>
    <p style="margin:0">
      ${ranch?.phone ? `<a href="tel:${ranch.phone}" style="color:#ea580c;text-decoration:none">${ranch.phone}</a>` : ''}
      ${ranch?.phone && ranch?.email ? ' &nbsp;•&nbsp; ' : ''}
      ${ranch?.email ? `<a href="mailto:${ranch.email}" style="color:#ea580c;text-decoration:none">${ranch.email}</a>` : ''}
    </p>
    <p style="margin:16px 0 0;color:#444">© ${new Date().getFullYear()} ${ranchName}</p>
  </div>

</div>
</body>
</html>`

  // ── Generate PDF buffer for attachment ────────────────────────────────────
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateInvoicePdfBuffer(id)
  } catch { /* attach what we can */ }

  // ── Send via Resend ───────────────────────────────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromAddress = process.env.RESEND_FROM_EMAIL || `${ranchName} <billing@legacylandandcattleco.com>`

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from:    fromAddress,
    to:      owner.email,
    subject: `${ranchName} — Invoice ${invoice.invoice_number}`,
    html:    emailHtml,
  }

  if (pdfBuffer) {
    emailPayload.attachments = [{
      filename: `Invoice-${invoice.invoice_number}.pdf`,
      content:  pdfBuffer.toString('base64'),
    }]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: sendError } = await resend.emails.send(emailPayload)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (sendError) return NextResponse.json({ error: (sendError as any).message ?? 'Email send failed' }, { status: 500 })

  // ── Update invoice status ─────────────────────────────────────────────────
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('invoices').update({
    status:        'sent',
    sent_at:       now,
    email_sent_at: now,
    ...(paymentUrl ? { square_payment_link: paymentUrl } : {}),
  }).eq('id', id)

  return NextResponse.json({ ok: true, square_link: paymentUrl })
}
