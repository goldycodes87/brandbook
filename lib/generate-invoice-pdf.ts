import { PDFDocument, PDFImage, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Page constants (Letter) ─────────────────────────────────────────────────
const PW = 612
const PH = 792
const M  = 48          // margin
const CW = PW - M * 2  // 516 content width

// ── Colors ──────────────────────────────────────────────────────────────────
const RED      = rgb(0.545, 0.102, 0.102)
const LIGHT_RED = rgb(0.957, 0.761, 0.761)
const WHITE    = rgb(1, 1, 1)
const DARK     = rgb(0.067, 0.067, 0.067)
const GRAY     = rgb(0.333, 0.333, 0.333)
const MID_GRAY = rgb(0.600, 0.600, 0.600)
const BG_GRAY  = rgb(0.973, 0.973, 0.973)
const RULE     = rgb(0.878, 0.878, 0.878)

type RawLineItem = {
  description: string
  quantity?: number | null
  unit_price?: number | null
  amount: number
  is_header?: boolean
  share_note?: string
}

function sanitize(s: string): string {
  // Strip Unicode box-drawing chars (U+2500-U+257F) — not in WinAnsi font encoding
  return s.replace(/[─-╿]/g, '-')
}

async function fetchLogoImage(pdfDoc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('png') || url.toLowerCase().includes('.png')) {
      return await pdfDoc.embedPng(buf)
    }
    return await pdfDoc.embedJpg(buf)
  } catch {
    return null
  }
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

function textWidth(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size)
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (textWidth(font, test, size) <= maxWidth) { cur = test }
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function rightText(page: PDFPage, font: PDFFont, text: string, size: number, rightEdge: number, y: number, color = DARK) {
  const w = textWidth(font, text, size)
  page.drawText(text, { x: rightEdge - w, y, size, font, color })
}

function centerText(page: PDFPage, font: PDFFont, text: string, size: number, cx: number, cy: number, color = DARK) {
  const w = textWidth(font, text, size)
  page.drawText(text, { x: cx - w / 2, y: cy, size, font, color })
}

// ── Annual report: simple HTML → text PDF ───────────────────────────────────
export async function generatePDF(html: string): Promise<Buffer> {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|h[1-6]|li)[^>]*>/gi, '\n')
    .replace(/<td[^>]*>|<th[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim()

  const lines = text.split('\n').filter(l => l.trim())
  const pdfDoc = await PDFDocument.create()
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const LH = 14

  let page = pdfDoc.addPage([PW, PH])
  let y = PH - M

  for (const line of lines) {
    if (y < M + LH) { page = pdfDoc.addPage([PW, PH]); y = PH - M }
    const wrapped = wrapText(font, line.trim(), 10, CW)
    for (const wl of wrapped) {
      if (y < M + LH) { page = pdfDoc.addPage([PW, PH]); y = PH - M }
      page.drawText(sanitize(wl), { x: M, y, size: 10, font, color: DARK })
      y -= LH
    }
  }

  return Buffer.from(await pdfDoc.save())
}

// ── Invoice PDF ──────────────────────────────────────────────────────────────
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
  const r = ranch as any
  const ranchName  = r?.ranch_name || 'Legacy Land & Cattle, LLC'
  const ranchAddr  = [r?.address, r?.city, r?.state, r?.zip].filter(Boolean).join(', ')
  const ranchPhone = r?.phone  || ''
  const ranchEmail = r?.email  || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner        = invoice.owner as any
  const ownerDisplay = owner?.company_name || owner?.owner_name || owner?.name || 'Unknown Owner'
  const ownerEmail   = owner?.email || ''

  const lineItems = (invoice.line_items as RawLineItem[]) || []
  const subtotal  = lineItems.reduce((s, li) => s + (li.amount ?? 0), 0)

  const pdfDoc  = await PDFDocument.create()
  const font    = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const logoImg = r?.logo_url ? await fetchLogoImage(pdfDoc, r.logo_url) : null

  const page = pdfDoc.addPage([PW, PH])
  let y = PH - M

  // ── Header ─────────────────────────────────────────────────────────────────
  if (logoImg) {
    const dims = logoImg.scaleToFit(200, 50)
    page.drawImage(logoImg, { x: M, y: PH - M - dims.height, width: dims.width, height: dims.height })
    // Contact info right-aligned below INVOICE word
    let ry = PH - M - 44
    if (ranchAddr) { rightText(page, font, ranchAddr, 8, PW - M, ry, GRAY); ry -= 12 }
    if (ranchPhone || ranchEmail) {
      rightText(page, font, [ranchPhone, ranchEmail].filter(Boolean).join(' · '), 8, PW - M, ry, GRAY)
    }
  } else {
    page.drawText(ranchName, { x: M, y, size: 18, font: fontBold, color: DARK })
    if (ranchAddr) {
      y -= 16
      page.drawText(ranchAddr, { x: M, y, size: 9, font, color: GRAY })
    }
    if (ranchPhone || ranchEmail) {
      y -= 12
      page.drawText([ranchPhone, ranchEmail].filter(Boolean).join(' · '), { x: M, y, size: 9, font, color: GRAY })
    }
  }

  // INVOICE top-right
  page.drawText('INVOICE', { x: PW - M - textWidth(fontBold, 'INVOICE', 36), y: PH - M, size: 36, font: fontBold, color: RED })

  // Red rule
  const ruleY = PH - M - 58
  page.drawLine({ start: { x: M, y: ruleY }, end: { x: PW - M, y: ruleY }, thickness: 3, color: RED })

  // ── Info strip ─────────────────────────────────────────────────────────────
  const STRIP_H = 54
  const STRIP_Y = ruleY - STRIP_H - 2
  page.drawRectangle({ x: M, y: STRIP_Y, width: CW, height: STRIP_H, color: RED })

  const cellW = CW / 3
  const stripCells = [
    {
      label: 'DATE',
      value: fmtDate((invoice.created_at as string)?.slice(0, 10)),
      sub:   invoice.due_date ? `Due: ${fmtDate(invoice.due_date as string)}` : '',
    },
    { label: 'TO',             value: ownerDisplay,                        sub: ownerEmail },
    {
      label: 'GRAZING PERIOD',
      value: invoice.period_start
        ? `${fmtDate(invoice.period_start as string)} – ${fmtDate(invoice.period_end as string)}`
        : '—',
      sub: invoice.invoice_number ? `Inv # ${invoice.invoice_number}` : '',
    },
  ]

  stripCells.forEach((cell, i) => {
    const cx = M + i * cellW + 10
    const top = STRIP_Y + STRIP_H - 10
    page.drawText(cell.label, { x: cx, y: top - 8,  size: 7,  font: fontBold, color: LIGHT_RED })
    // Truncate value if too wide
    let val = cell.value
    while (val.length > 3 && textWidth(fontBold, val, 11) > cellW - 20) val = val.slice(0, -4) + '…'
    page.drawText(val,       { x: cx, y: top - 21, size: 11, font: fontBold, color: WHITE })
    if (cell.sub) {
      let sub = cell.sub
      while (sub.length > 3 && textWidth(font, sub, 9) > cellW - 20) sub = sub.slice(0, -4) + '…'
      page.drawText(sub, { x: cx, y: top - 34, size: 9, font, color: LIGHT_RED })
    }
  })

  y = STRIP_Y - 14

  // ── Line items ─────────────────────────────────────────────────────────────
  const COL_QTY  = 36
  const COL_UP   = 90
  const COL_AMT  = 90
  const COL_DESC = CW - COL_QTY - COL_UP - COL_AMT

  const xQty  = M
  const xDesc = M + COL_QTY
  const xUp   = xDesc + COL_DESC
  const xAmt  = xUp + COL_UP

  // Table header row
  const HDR_H = 22
  page.drawRectangle({ x: M, y: y - HDR_H, width: CW, height: HDR_H, color: RED })
  centerText(page, fontBold, 'QTY',        8, xQty  + COL_QTY  / 2, y - 14, WHITE)
  page.drawText('DESCRIPTION', { x: xDesc + 4, y: y - 14, size: 8, font: fontBold, color: WHITE })
  rightText(page, fontBold, 'UNIT PRICE', 8, xUp  + COL_UP  - 4, y - 14, WHITE)
  rightText(page, fontBold, 'TOTAL',      8, xAmt + COL_AMT - 4, y - 14, WHITE)
  y -= HDR_H

  for (const li of lineItems) {
    if (li.is_header) {
      y -= 2
      page.drawRectangle({ x: M, y: y - 20, width: CW, height: 20, color: BG_GRAY })
      page.drawText(sanitize(li.description), { x: xDesc + 4, y: y - 14, size: 9, font: fontBold, color: RED })
      y -= 22
      continue
    }

    const descLines  = wrapText(font, sanitize(li.description), 10, COL_DESC - 8)
    const shareLines = li.share_note ? wrapText(font, sanitize(li.share_note), 8, COL_DESC - 8) : []
    const rowH = Math.max(22, (descLines.length + shareLines.length) * 13 + 10)

    page.drawLine({ start: { x: M, y: y + 1 }, end: { x: PW - M, y: y + 1 }, thickness: 0.5, color: RULE })

    const ty = y - 13

    if (li.quantity != null) {
      centerText(page, font, String(li.quantity), 10, xQty + COL_QTY / 2, ty, GRAY)
    }

    descLines.forEach((dl, idx) => {
      page.drawText(dl, { x: xDesc + 4, y: ty - idx * 13, size: 10, font, color: DARK })
    })
    shareLines.forEach((sl, idx) => {
      page.drawText(sl, { x: xDesc + 4, y: ty - descLines.length * 13 - idx * 12, size: 8, font, color: MID_GRAY })
    })

    if (li.unit_price != null) {
      rightText(page, font, fmt(Number(li.unit_price)), 10, xUp + COL_UP - 4, ty, GRAY)
    }
    if (li.amount > 0) {
      rightText(page, fontBold, fmt(li.amount), 10, xAmt + COL_AMT - 4, ty)
    }

    y -= rowH
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  y -= 6
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: RULE })

  const TOT_X = PW - M - 240

  y -= 16
  page.drawText('Subtotal', { x: TOT_X, y, size: 10, font, color: GRAY })
  rightText(page, font, fmt(subtotal), 10, PW - M, y, GRAY)

  y -= 16
  page.drawText('Tax', { x: TOT_X, y, size: 10, font, color: GRAY })
  rightText(page, font, '$0.00', 10, PW - M, y, GRAY)

  // Total due box
  y -= 6
  page.drawRectangle({ x: TOT_X - 8, y: y - 8, width: PW - M - TOT_X + 8, height: 32, color: BG_GRAY })
  page.drawLine({ start: { x: TOT_X - 8, y: y + 24 }, end: { x: PW - M, y: y + 24 }, thickness: 2, color: RED })
  y -= 2
  page.drawText('TOTAL DUE', { x: TOT_X, y, size: 12, font: fontBold, color: DARK })
  rightText(page, fontBold, fmt(invoice.total_amount as number), 18, PW - M, y - 2, RED)

  // ── Thank you ───────────────────────────────────────────────────────────────
  y -= 52
  page.drawLine({ start: { x: M, y: y + 24 }, end: { x: PW - M, y: y + 24 }, thickness: 0.5, color: RULE })
  const tyText = 'Thank you for your business!'
  centerText(page, font, tyText, 12, PW / 2, y, RED)

  if (invoice.notes) {
    y -= 28
    page.drawText(`Notes: ${invoice.notes}`, { x: M, y, size: 10, font, color: GRAY, maxWidth: CW })
  }

  return Buffer.from(await pdfDoc.save())
}
