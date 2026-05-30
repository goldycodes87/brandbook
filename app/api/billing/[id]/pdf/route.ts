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

  const lineItemRows = (invoice.line_items ?? []).map((li: { description: string; amount: number }) =>
    `<tr><td class="td-desc">${li.description}</td><td class="td-amt">${fmtMoney(li.amount)}</td></tr>`
  ).join('')

  const expenseRows = (invoice.expense_splits ?? []).map((e: { description: string; category?: string; owner_amount: number }) =>
    `<tr><td class="td-desc">${e.description}${e.category ? ` <span class="cat">(${e.category})</span>` : ''}</td><td class="td-amt">${fmtMoney(e.owner_amount)}</td></tr>`
  ).join('')

  const headerLogoHtml = logoUrl
    ? `<img src="${logoUrl}" style="max-height:52px;max-width:180px;object-fit:contain" alt="logo">`
    : `<div style="font-size:26px;font-weight:800;color:white;letter-spacing:-0.5px"><span style="color:#ea580c">BRAND</span>BOOK</div>`

  const squareLinkSection = invoice.square_payment_link
    ? `<div style="background:#fff7ed;border-top:3px solid #ea580c;padding:20px 40px">
         <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#92400e;font-weight:700;margin-bottom:6px">PAY ONLINE</div>
         <div style="font-size:12px;color:#ea580c;word-break:break-all">${invoice.square_payment_link}</div>
       </div>`
    : ''

  const watermarkHtml = brandUrl
    ? `<img src="${brandUrl}" style="opacity:0.06;max-height:72px;max-width:72px;object-fit:contain" alt="">`
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: white; }

  .hdr { background: #111; padding: 28px 40px; display: flex; align-items: center; justify-content: space-between; }
  .hdr-sub { font-size: 12px; color: #888; margin-top: 6px; }

  .inv-title { font-size: 34px; font-weight: 800; letter-spacing: 3px; color: #ea580c; }
  .inv-num   { font-family: monospace; font-size: 13px; color: #aaa; margin-top: 4px; }
  .badge     { display:inline-block; padding:3px 10px; border-radius:3px; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-top:8px; }
  .badge-paid   { background:#d1fae5; color:#065f46; }
  .badge-sent   { background:#dbeafe; color:#1e40af; }
  .badge-draft  { background:#f3f4f6; color:#374151; }

  .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; border-bottom:1px solid #e5e7eb; }
  .info-cell { padding:22px 40px; }
  .info-cell + .info-cell { border-left:1px solid #e5e7eb; }
  .info-lbl  { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#999; font-weight:700; margin-bottom:8px; }
  .info-val  { font-size:15px; font-weight:600; color:#111; }
  .info-sub  { font-size:12px; color:#666; margin-top:3px; }
  .info-due  { font-size:12px; color:#dc2626; font-weight:600; margin-top:3px; }

  .body { padding: 0 40px 32px; }
  .sec-lbl { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#999; font-weight:700; margin:24px 0 6px; }

  table { width:100%; border-collapse:collapse; }
  thead tr { background:#111; }
  th { padding:9px 12px; font-size:9px; text-transform:uppercase; letter-spacing:1px; font-weight:700; color:white; text-align:left; }
  th:last-child { text-align:right; }
  .td-desc { padding:10px 12px; font-size:13px; border-bottom:1px solid #f0f0f0; color:#222; }
  .td-amt  { padding:10px 12px; font-size:13px; border-bottom:1px solid #f0f0f0; text-align:right; color:#222; }
  .cat { color:#999; font-size:11px; }
  .total-row td { padding:14px 12px; font-weight:700; font-size:15px; border-top:2px solid #111; border-bottom:none; background:#f9fafb; }
  .total-amt { text-align:right; font-size:22px; color:#ea580c; }

  .notes { font-size:12px; color:#666; margin-top:20px; padding-top:16px; border-top:1px solid #f0f0f0; }

  .footer { padding:16px 40px; border-top:1px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between; }
  .footer-txt { font-size:10px; color:#aaa; }
</style>
</head>
<body>

  <div class="hdr">
    <div>
      ${headerLogoHtml}
      ${ranchAddress ? `<div class="hdr-sub">${ranchAddress}</div>` : ''}
      ${ranchPhone   ? `<div class="hdr-sub">${ranchPhone}</div>`   : ''}
    </div>
    <div style="text-align:right">
      <div class="inv-title">INVOICE</div>
      <div class="inv-num">${invoice.invoice_number}</div>
      <div><span class="badge badge-${isPaid ? 'paid' : invoice.status}">${invoice.status.toUpperCase()}</span></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-cell">
      <div class="info-lbl">BILLED TO</div>
      <div class="info-val">${ownerDisplay}</div>
      ${owner?.email ? `<div class="info-sub">${owner.email}</div>`  : ''}
      ${owner?.phone ? `<div class="info-sub">${owner.phone}</div>`  : ''}
    </div>
    <div class="info-cell">
      <div class="info-lbl">INVOICE DETAILS</div>
      <div class="info-sub">Date: ${invoiceDate}</div>
      ${invoice.due_date  ? `<div class="info-due">Due: ${dueDate}</div>`                                       : ''}
      ${ranchPhone        ? `<div class="info-sub">${ranchPhone}</div>`                                         : ''}
      ${ranchEmail        ? `<div class="info-sub">${ranchEmail}</div>`                                         : ''}
    </div>
    <div class="info-cell">
      <div class="info-lbl">GRAZING PERIOD</div>
      ${invoice.period_start
        ? `<div class="info-val" style="font-size:13px">${fmtDate(invoice.period_start)}</div>
           <div class="info-sub">to ${fmtDate(invoice.period_end)}</div>`
        : '<div class="info-sub">—</div>'}
    </div>
  </div>

  <div class="body">
    ${lineItemRows ? `
      <div class="sec-lbl">GRAZING CHARGES</div>
      <table>
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>${lineItemRows}</tbody>
      </table>` : ''}

    ${expenseRows ? `
      <div class="sec-lbl">EXPENSE ALLOCATIONS</div>
      <table>
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody>${expenseRows}</tbody>
      </table>` : ''}

    <table style="margin-top:${(lineItemRows || expenseRows) ? '12px' : '24px'}">
      <tbody>
        <tr class="total-row">
          <td>TOTAL DUE</td>
          <td class="total-amt">${fmtMoney(invoice.total_amount)}</td>
        </tr>
      </tbody>
    </table>

    ${invoice.notes ? `<div class="notes">Notes: ${invoice.notes}</div>` : ''}
  </div>

  ${squareLinkSection}

  <div class="footer">
    <div class="footer-txt">
      ${ranchName} · Thank you for your business.${invoice.due_date ? ` Please remit payment by ${dueDate}.` : ''}
    </div>
    ${watermarkHtml}
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
