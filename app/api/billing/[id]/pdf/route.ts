export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'

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

  const { data: ranch } = await supabase.from('ranch_settings').select('*').limit(1).maybeSingle()
  const ranchName    = ranch?.ranch_name || 'Brand Book Ranch'
  const ranchAddress = [ranch?.address, ranch?.city, ranch?.state, ranch?.zip].filter(Boolean).join(', ')
  const ranchPhone   = ranch?.phone || ''
  const ranchEmail   = ranch?.email || ''
  const logoUrl      = ranch?.logo_url || ''
  const brandUrl     = ranch?.brand_photo_url || ''

  const owner        = invoice.owner
  const ownerDisplay = owner?.company_name || owner?.owner_name || owner?.name || 'Unknown Owner'

  const fmtDate  = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const fmtMoney = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isPaid      = invoice.status === 'paid'
  const invoiceDate = fmtDate(invoice.created_at?.slice(0, 10))
  const dueDate     = fmtDate(invoice.due_date)

  const lineItems: Array<{ description: string; quantity: number; unit_price: number; amount: number }> =
    (invoice.line_items ?? []).map((li: { description: string; quantity?: number; unit_price?: number; amount: number }) => ({
      description: li.description,
      quantity:    li.quantity   ?? 1,
      unit_price:  li.unit_price ?? li.amount,
      amount:      li.amount,
    }))

  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0)

  const lineItemRows = lineItems.map(li =>
    `<tr>
      <td class="td-qty">${li.quantity}</td>
      <td class="td-desc">${li.description}</td>
      <td class="td-up">${fmtMoney(li.unit_price)}</td>
      <td class="td-amt">${fmtMoney(li.amount)}</td>
    </tr>`
  ).join('')

  const headerLogoHtml = logoUrl
    ? `<img src="${logoUrl}" style="max-height:64px;max-width:200px;object-fit:contain" alt="logo">`
    : `<div style="font-size:28px;font-weight:800;color:#111;letter-spacing:-0.5px">${ranchName}</div>`

  const squareLinkSection = invoice.square_payment_link
    ? `<div style="background:#fff7f7;border-top:2px solid #8b1a1a;padding:14px 48px">
         <span style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#8b1a1a;font-weight:700">Pay Online: </span>
         <span style="font-size:11px;color:#8b1a1a">${invoice.square_payment_link}</span>
       </div>`
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: white; position: relative; }

  /* Rotated invoice number strip */
  .inv-num-strip {
    position: absolute;
    top: 88px;
    right: -46px;
    width: 160px;
    text-align: center;
    transform: rotate(90deg);
    transform-origin: center center;
    font-size: 48px;
    font-weight: 900;
    letter-spacing: -2px;
    color: #e8e8e8;
    font-family: monospace;
    pointer-events: none;
    z-index: 0;
  }

  /* Header */
  .hdr { padding: 32px 48px 20px; display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #8b1a1a; }
  .hdr-right { text-align: right; }
  .inv-word { font-size: 42px; font-weight: 900; letter-spacing: 6px; color: #8b1a1a; line-height: 1; }
  .hdr-addr { font-size: 11px; color: #555; margin-top: 6px; line-height: 1.6; }

  /* Red info row */
  .info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; background: #8b1a1a; }
  .info-cell { padding: 12px 20px; }
  .info-lbl  { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #f4c2c2; font-weight: 700; margin-bottom: 4px; }
  .info-val  { font-size: 13px; font-weight: 700; color: #fff; }
  .info-sub  { font-size: 11px; color: #f4c2c2; margin-top: 2px; }

  /* Body */
  .body { padding: 28px 48px 20px; position: relative; z-index: 1; }

  /* Line items table */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #8b1a1a; }
  th { padding: 9px 12px; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #fff; text-align: left; }
  th.right { text-align: right; }

  .td-qty  { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; color: #555; width: 48px; text-align: center; }
  .td-desc { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; color: #222; }
  .td-up   { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #555; width: 110px; }
  .td-amt  { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #222; font-weight: 600; width: 110px; }

  /* Totals block */
  .totals { margin-top: 0; }
  .totals table { width: 320px; margin-left: auto; }
  .tot-lbl { padding: 8px 12px; font-size: 12px; color: #555; border-bottom: 1px solid #f0f0f0; }
  .tot-val { padding: 8px 12px; font-size: 12px; color: #222; text-align: right; border-bottom: 1px solid #f0f0f0; font-weight: 600; }
  .tot-due-lbl { padding: 12px 12px; font-size: 14px; font-weight: 800; color: #111; background: #f9f9f9; border-top: 2px solid #8b1a1a; }
  .tot-due-val { padding: 12px 12px; font-size: 20px; font-weight: 900; color: #8b1a1a; text-align: right; background: #f9f9f9; border-top: 2px solid #8b1a1a; }

  /* Thank you */
  .thankyou { text-align: center; font-size: 14px; font-style: italic; color: #8b1a1a; margin: 28px 48px 0; padding-top: 16px; border-top: 1px solid #e5e7eb; }

  /* Footer */
  .footer { padding: 14px 48px; margin-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .footer-txt { font-size: 10px; color: #aaa; }

  .notes-box { margin-top: 20px; padding: 12px 16px; background: #f9f9f9; border-left: 3px solid #8b1a1a; font-size: 12px; color: #555; }
</style>
</head>
<body>

  <!-- Rotated invoice number watermark -->
  <div class="inv-num-strip">${invoice.invoice_number}</div>

  <!-- Header: logo left, INVOICE right -->
  <div class="hdr">
    <div>
      ${headerLogoHtml}
      ${ranchAddress ? `<div class="hdr-addr">${ranchAddress.split(', ').join('<br>')}</div>` : ''}
    </div>
    <div class="hdr-right">
      <div class="inv-word">INVOICE</div>
    </div>
  </div>

  <!-- Red info row -->
  <div class="info-row">
    <div class="info-cell">
      <div class="info-lbl">Date</div>
      <div class="info-val">${invoiceDate}</div>
      ${invoice.due_date ? `<div class="info-sub">Due: ${dueDate}</div>` : ''}
    </div>
    <div class="info-cell">
      <div class="info-lbl">To</div>
      <div class="info-val">${ownerDisplay}</div>
      ${owner?.email ? `<div class="info-sub">${owner.email}</div>` : ''}
    </div>
    <div class="info-cell">
      <div class="info-lbl">Grazing Period</div>
      ${invoice.period_start
        ? `<div class="info-val" style="font-size:12px">${fmtDate(invoice.period_start)} – ${fmtDate(invoice.period_end)}</div>`
        : `<div class="info-val">—</div>`}
      ${invoice.invoice_number ? `<div class="info-sub">Inv # ${invoice.invoice_number}</div>` : ''}
    </div>
  </div>

  <div class="body">
    <!-- Line items -->
    <table>
      <thead>
        <tr>
          <th style="width:48px;text-align:center">Qty</th>
          <th>Description</th>
          <th class="right" style="width:110px">Unit Price</th>
          <th class="right" style="width:110px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows || `<tr><td class="td-qty">—</td><td class="td-desc" colspan="3" style="color:#999">No line items</td></tr>`}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals" style="margin-top:8px">
      <table>
        <tbody>
          <tr>
            <td class="tot-lbl">Subtotal</td>
            <td class="tot-val">${fmtMoney(subtotal)}</td>
          </tr>
          <tr>
            <td class="tot-lbl">Tax</td>
            <td class="tot-val">$0.00</td>
          </tr>
          <tr>
            <td class="tot-due-lbl">TOTAL DUE</td>
            <td class="tot-due-val">${fmtMoney(invoice.total_amount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${invoice.notes ? `<div class="notes-box">Notes: ${invoice.notes}</div>` : ''}
  </div>

  ${squareLinkSection}

  <div class="thankyou">Thank you for your business!</div>

  <div class="footer">
    <div class="footer-txt">${ranchName}</div>
    <div class="footer-txt">${[ranchPhone, ranchEmail].filter(Boolean).join(' · ')}</div>
  </div>

</body></html>`

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const htmlPdfNode = require('html-pdf-node') as { generatePdf: (file: { content: string }, options: object) => Promise<Buffer> }
  const pdfBuffer = await htmlPdfNode.generatePdf({ content: html }, { format: 'A4' })

  const pdfKey = `invoices/${invoice.invoice_number}.pdf`
  const pdfUrl = await uploadToR2(pdfKey, pdfBuffer, 'application/pdf')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('invoices').update({ pdf_url: pdfUrl }).eq('id', id)

  return NextResponse.json({ pdf_url: pdfUrl })
}
