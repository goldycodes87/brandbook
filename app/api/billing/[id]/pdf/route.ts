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

  const owner        = invoice.owner
  const ownerDisplay = owner?.company_name || owner?.owner_name || owner?.name || 'Unknown Owner'

  const fmtDate  = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const fmtMoney = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const lineItemsHTML = (invoice.line_items ?? []).map((li: { description: string; amount: number }) =>
    `<tr><td>${li.description}</td><td class="amount">${fmtMoney(li.amount)}</td></tr>`).join('')

  const expensesHTML = (invoice.expense_splits ?? []).map((e: { description: string; owner_amount: number }) =>
    `<tr><td>${e.description}</td><td class="amount">${fmtMoney(e.owner_amount)}</td></tr>`).join('')

  const isPaid       = invoice.status === 'paid'
  const invoiceDate  = fmtDate(invoice.created_at?.slice(0, 10))
  const dueDate      = fmtDate(invoice.due_date)

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; align-items: flex-start; }
  .ranch-name { font-size: 24px; font-weight: bold; }
  .ranch-sub { font-size: 12px; color: #666; margin-top: 4px; }
  .invoice-title { font-size: 32px; color: #ea580c; font-weight: bold; }
  .invoice-number { color: #666; font-size: 13px; font-family: monospace; }
  .to-from { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 30px 0; }
  .label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f5f5f5; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
  td { padding: 10px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #111; border-bottom: none; padding-top: 14px; }
  .amount { text-align: right; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: 1px; }
  .badge-paid { background: #d1fae5; color: #065f46; }
  .badge-sent { background: #dbeafe; color: #1e40af; }
  .badge-draft { background: #f3f4f6; color: #374151; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="ranch-name">${ranchName}</div>
      ${ranchAddress ? `<div class="ranch-sub">${ranchAddress}</div>` : ''}
      ${ranchPhone   ? `<div class="ranch-sub">${ranchPhone}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Date: ${invoiceDate}</div>
      ${invoice.due_date ? `<div style="font-size:12px;color:#666">Due: ${dueDate}</div>` : ''}
      <div style="margin-top:8px">
        <span class="badge badge-${isPaid ? 'paid' : invoice.status}">${invoice.status.toUpperCase()}</span>
      </div>
    </div>
  </div>

  <div class="to-from">
    <div>
      <div class="label">Bill To</div>
      <div style="font-weight:600">${ownerDisplay}</div>
      ${owner?.email ? `<div style="font-size:13px;color:#666;margin-top:2px">${owner.email}</div>` : ''}
      ${owner?.phone ? `<div style="font-size:13px;color:#666">${owner.phone}</div>` : ''}
    </div>
    <div>
      <div class="label">Grazing Period</div>
      <div style="font-size:14px">${fmtDate(invoice.period_start)} to ${fmtDate(invoice.period_end)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
    <tbody>
      ${lineItemsHTML}${expensesHTML}
      <tr class="total-row">
        <td>TOTAL DUE</td>
        <td class="amount">${fmtMoney(invoice.total_amount)}</td>
      </tr>
    </tbody>
  </table>

  ${invoice.notes ? `<p style="color:#666;font-size:13px;margin-top:20px">Notes: ${invoice.notes}</p>` : ''}
  <p style="color:#bbb;font-size:11px;margin-top:40px;text-align:center">
    Thank you for your business.${invoice.due_date ? ` Please remit payment by ${dueDate}.` : ''}
  </p>
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
