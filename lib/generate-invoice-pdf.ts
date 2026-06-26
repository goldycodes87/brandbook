// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake')
import { createAdminClient } from '@/lib/supabase/admin'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = any

const BRAND_RED = '#8b1a1a'
const LIGHT_RED = '#f4c2c2'

const PDF_FONTS = {
  Helvetica: {
    normal:      'Helvetica',
    bold:        'Helvetica-Bold',
    italics:     'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

type RawLineItem = {
  description: string
  quantity?: number | null
  unit_price?: number | null
  amount: number
  is_header?: boolean
  share_note?: string
}

function fmt(n: number): string {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct  = res.headers.get('content-type') || 'image/png'
    return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

function buildPdfBuffer(docDef: DocDef): Promise<Buffer> {
  const printer = new PdfPrinter(PDF_FONTS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = printer.createPdfKitDocument(docDef as any)
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

// Used by the annual-report route — converts HTML to a plain-text readable PDF
export async function generatePDF(html: string): Promise<Buffer> {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|h[1-6]|li)[^>]*>/gi, '\n')
    .replace(/<td[^>]*>|<th[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const lines = text.split('\n').filter(l => l.trim())

  const docDef: DocDef = {
    pageSize:     'LETTER',
    pageMargins:  [48, 48, 48, 48],
    defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.35 },
    content: lines.map(line => ({ text: line.trim(), margin: [0, 2, 0, 2] })),
  }

  return buildPdfBuffer(docDef)
}

export async function generateInvoicePdfBuffer(invoiceId: string): Promise<Buffer> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error } = await (supabase as any)
    .from('invoices')
    .select('*, owner:grazing_owners(*)')
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) throw new Error('Invoice not found')

  const { data: ranch } = await supabase.from('ranch_settings').select('*').limit(1).maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r           = ranch as any
  const ranchName   = r?.ranch_name || 'Legacy Land & Cattle, LLC'
  const ranchAddr   = [r?.address, r?.city, r?.state, r?.zip].filter(Boolean).join(', ')
  const ranchPhone  = r?.phone || ''
  const ranchEmailV = r?.email || ''
  const logoUrl     = r?.logo_url || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner        = invoice.owner as any
  const ownerDisplay = owner?.company_name || owner?.owner_name || owner?.name || 'Unknown Owner'
  const ownerEmail   = owner?.email || ''

  const lineItems = (invoice.line_items as RawLineItem[]) || []
  const subtotal  = lineItems.reduce((s, li) => s + (li.amount ?? 0), 0)

  const logoB64 = logoUrl ? await fetchBase64(logoUrl) : null

  // ── Line-items table body ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBody: any[][] = [
    [
      { text: 'QTY',         style: 'th', alignment: 'center' },
      { text: 'DESCRIPTION', style: 'th' },
      { text: 'UNIT PRICE',  style: 'th', alignment: 'right' },
      { text: 'TOTAL',       style: 'th', alignment: 'right' },
    ],
  ]

  for (const li of lineItems) {
    if (li.is_header) {
      tableBody.push([
        {
          text: li.description, colSpan: 4,
          fillColor: '#f5f5f5', color: BRAND_RED,
          fontSize: 9, bold: true, characterSpacing: 1,
          margin: [0, 6, 0, 2],
        },
        {}, {}, {},
      ])
    } else {
      tableBody.push([
        { text: li.quantity != null ? String(li.quantity) : '', alignment: 'center', fontSize: 11, color: '#555' },
        {
          stack: [
            { text: li.description, fontSize: 11 },
            ...(li.share_note ? [{ text: li.share_note, fontSize: 9, color: '#999' }] : []),
          ],
        },
        { text: li.unit_price != null ? fmt(Number(li.unit_price)) : '', alignment: 'right', fontSize: 11, color: '#555' },
        { text: li.amount > 0 ? fmt(li.amount) : '', alignment: 'right', fontSize: 11, bold: true },
      ])
    }
  }

  if (lineItems.length === 0) {
    tableBody.push([{ text: 'No line items', colSpan: 4, alignment: 'center', color: '#999' }, {}, {}, {}])
  }

  // ── Document definition ──────────────────────────────────────────────────
  const docDef: DocDef = {
    pageSize:     'LETTER',
    pageMargins:  [48, 48, 48, 48],
    defaultStyle: { font: 'Helvetica', fontSize: 12 },

    styles: {
      th: { fontSize: 9, bold: true, color: '#fff', fillColor: BRAND_RED, characterSpacing: 1.5 },
    },

    content: [
      // Header
      {
        columns: [
          {
            stack: [
              logoB64
                ? { image: logoB64, width: 140, margin: [0, 0, 0, 4] }
                : { text: ranchName, fontSize: 20, bold: true, color: '#111' },
              ...(ranchAddr  ? [{ text: ranchAddr,  fontSize: 10, color: '#555', margin: [0, 4, 0, 0] }] : []),
              ...([ranchPhone, ranchEmailV].filter(Boolean).length
                ? [{ text: [ranchPhone, ranchEmailV].filter(Boolean).join(' · '), fontSize: 10, color: '#555' }]
                : []),
            ],
            width: '*',
          },
          { text: 'INVOICE', fontSize: 36, bold: true, color: BRAND_RED, alignment: 'right', width: 'auto' },
        ],
      },
      // Red rule
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 519, y2: 0, lineWidth: 3, lineColor: BRAND_RED }],
        margin: [0, 12, 0, 0],
      },
      // Info strip
      {
        table: {
          widths: ['*', '*', '*'],
          body: [[
            {
              stack: [
                { text: 'DATE', fontSize: 8, color: LIGHT_RED, bold: true, characterSpacing: 2 },
                { text: fmtDate((invoice.created_at as string)?.slice(0, 10)), fontSize: 12, bold: true, color: '#fff', margin: [0, 3, 0, 0] },
                ...(invoice.due_date ? [{ text: `Due: ${fmtDate(invoice.due_date as string)}`, fontSize: 10, color: LIGHT_RED }] : []),
              ],
              fillColor: BRAND_RED,
              border: [false, false, false, false],
              margin: [12, 10, 12, 10],
            },
            {
              stack: [
                { text: 'TO', fontSize: 8, color: LIGHT_RED, bold: true, characterSpacing: 2 },
                { text: ownerDisplay, fontSize: 12, bold: true, color: '#fff', margin: [0, 3, 0, 0] },
                ...(ownerEmail ? [{ text: ownerEmail, fontSize: 10, color: LIGHT_RED }] : []),
              ],
              fillColor: BRAND_RED,
              border: [false, false, false, false],
              margin: [12, 10, 12, 10],
            },
            {
              stack: [
                { text: 'GRAZING PERIOD', fontSize: 8, color: LIGHT_RED, bold: true, characterSpacing: 2 },
                {
                  text: invoice.period_start
                    ? `${fmtDate(invoice.period_start as string)} – ${fmtDate(invoice.period_end as string)}`
                    : '—',
                  fontSize: 11, bold: true, color: '#fff', margin: [0, 3, 0, 0],
                },
                ...(invoice.invoice_number ? [{ text: `Inv # ${invoice.invoice_number}`, fontSize: 10, color: LIGHT_RED }] : []),
              ],
              fillColor: BRAND_RED,
              border: [false, false, false, false],
              margin: [12, 10, 12, 10],
            },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      },

      // Line items
      {
        table: { widths: [40, '*', 90, 90], headerRows: 1, body: tableBody },
        layout: 'lightHorizontalLines',
      },

      // Totals (right-aligned via columns)
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 250,
            table: {
              widths: ['*', 100],
              body: [
                [
                  { text: 'Subtotal', fontSize: 11, color: '#555', border: [false, false, false, true] },
                  { text: fmt(subtotal), fontSize: 11, alignment: 'right', color: '#555', border: [false, false, false, true] },
                ],
                [
                  { text: 'Tax', fontSize: 11, color: '#555', border: [false, false, false, true] },
                  { text: '$0.00', fontSize: 11, alignment: 'right', color: '#555', border: [false, false, false, true] },
                ],
                [
                  { text: 'TOTAL DUE', fontSize: 13, bold: true, color: '#111', fillColor: '#f9f9f9', border: [false, true, false, false], borderColor: [BRAND_RED, BRAND_RED, BRAND_RED, BRAND_RED], margin: [6, 8, 0, 8] },
                  { text: fmt(invoice.total_amount as number), fontSize: 18, bold: true, color: BRAND_RED, alignment: 'right', fillColor: '#f9f9f9', border: [false, true, false, false], borderColor: [BRAND_RED, BRAND_RED, BRAND_RED, BRAND_RED], margin: [0, 8, 6, 8] },
                ],
              ],
            },
            layout: 'noBorders',
          },
        ],
        margin: [0, 8, 0, 0],
      },

      ...(invoice.notes ? [{ text: `Notes: ${invoice.notes}`, fontSize: 11, color: '#555', margin: [0, 20, 0, 0] }] : []),

      {
        text:      'Thank you for your business!',
        alignment: 'center',
        italics:   true,
        color:     BRAND_RED,
        fontSize:  13,
        margin:    [0, 36, 0, 0],
      },
    ],
  }

  return buildPdfBuffer(docDef)
}
