import { createAdminClient } from '@/lib/supabase/admin'
import { recipientsFor } from '@/lib/notify-preferences'
import { describeAnimal } from '@/lib/animal-label'
import { sendPurchaseEmail, sendSaleEmail, brandForOwner } from '@/lib/emails-statement'
import { fmtDate } from '@/lib/format'
import type { SaleLine, AppliedFee } from '@/lib/sale-fees'
import { settleSale, lineAmount, lineDetail } from '@/lib/sale-fees'

/**
 * Sending the two transaction emails.
 *
 * Every write path that moves cattle calls one of these. They are deliberately
 * forgiving: an email that fails must never roll back a transfer or a sale.
 * The cattle moved whether or not Resend was reachable, and a route that
 * reports failure because of the mail leaves the operator re-running a
 * transfer that already happened.
 *
 * So these resolve what they can, send what they can, and return what went
 * out. The caller reports it; it does not act on it.
 */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://brandbook-zeta-eight.vercel.app'

/**
 * A photograph at the size the email actually draws it.
 *
 * The statements show each head at 38 pixels and were pointing at the
 * originals, which are whatever came off a phone — Daphne's is 9.1 MB. Five
 * head meant asking the reader's mail client for something like thirty
 * megabytes to paint five thumbnails, which on a phone in a pasture does not
 * render at all. 160px wide covers a 38px slot on a retina screen twice over.
 */
function thumb(url: string | null | undefined): string | null {
  const src = (url ?? '').trim()
  if (!src) return null

  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/+$/, '')
  // Only our own bucket goes through the resizer; anything else is passed
  // along untouched rather than handed to a route that will refuse it.
  if (!base || !src.startsWith(base)) return src

  const key = src.slice(base.length).replace(/^\/+/, '')
  return `${APP_URL()}/api/img?key=${encodeURIComponent(key)}&w=160`
}

interface OwnerRow {
  id: string
  name: string | null
  owner_name: string | null
  company_name: string | null
  portal_token: string | null
  brand_image_url: string | null
  brand_photo_url: string | null
  brand_drawing_url: string | null
}

const OWNER_COLS = 'id, name, owner_name, company_name, portal_token, brand_image_url, brand_photo_url, brand_drawing_url'

async function context(ownerId: string) {
  const supabase = createAdminClient()
  const [{ data: ranch }, { data: owner }] = await Promise.all([
    supabase.from('ranch_settings').select('ranch_name, logo_url').limit(1).maybeSingle(),
    supabase.from('grazing_owners').select(OWNER_COLS).eq('id', ownerId).maybeSingle(),
  ])

  const r = ranch as { ranch_name: string | null; logo_url: string | null } | null
  const o = owner as OwnerRow | null

  return {
    ranchName: (r?.ranch_name ?? '').trim() || 'Legacy Land and Cattle',
    logoUrl:   r?.logo_url ?? null,
    brandUrl:  brandForOwner(o),
    ownerName: o?.company_name || o?.owner_name || o?.name || 'Owner',
    url:       o?.portal_token ? `${APP_URL()}/owner/${o.portal_token}` : APP_URL(),
  }
}

export interface SentReport {
  sent: string[]
  skipped: string[]
  failed: Array<{ to: string; error: string }>
}

const empty = (): SentReport => ({ sent: [], skipped: [], failed: [] })

// ─── Cattle bought ───────────────────────────────────────────────────────────

export interface PurchasedHead {
  animalId: string
  pairAnimalId?: string | null
  amount: number | null
}

/**
 * Tell an owner what they just bought.
 *
 * Takes animal ids rather than prepared lines so the naming, the photographs
 * and the pair handling are resolved here, once, instead of at each call site.
 */
export async function notifyPurchase(opts: {
  ownerId: string
  sellerName: string
  date: string
  head: PurchasedHead[]
}): Promise<SentReport> {
  const people = await recipientsFor(opts.ownerId, 'purchases')
  if (people.length === 0 || opts.head.length === 0) return empty()

  const supabase = createAdminClient()
  const ids = opts.head.flatMap(h => [h.animalId, h.pairAnimalId].filter((x): x is string => Boolean(x)))

  const { data: animals } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, breed, ear_tag_color, photos')
    .in('id', ids)

  type A = {
    id: string; tag_number: string | null; name: string | null; sex: string | null
    breed: string | null; ear_tag_color: string | null; photos: string[] | null
  }
  const byId = new Map(((animals ?? []) as unknown as A[]).map(a => [a.id, a]))

  const lines = opts.head.map(h => {
    const cow  = byId.get(h.animalId)
    const calf = h.pairAnimalId ? byId.get(h.pairAnimalId) : undefined
    const label = describeAnimal({
      sex: cow?.sex, breed: cow?.breed, ear_tag_color: cow?.ear_tag_color,
      tag_number: cow?.tag_number, name: cow?.name,
      isPair: Boolean(calf), pairTag: calf?.tag_number,
    })
    return {
      title: label.title,
      tagLine: label.tagLine,
      amount: h.amount,
      photo: thumb(cow?.photos?.[0]),
    }
  })

  const headCount = opts.head.reduce((s, h) => s + (h.pairAnimalId ? 2 : 1), 0)
  const total = opts.head.reduce((s, h) => s + (h.amount ?? 0), 0)

  const { count } = await supabase
    .from('animals')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', opts.ownerId)
    .eq('status', 'active')

  const ctx = await context(opts.ownerId)
  const report = empty()

  for (const p of people) {
    const res = await sendPurchaseEmail(p.email, {
      ...ctx,
      personName: p.name,
      date: opts.date,
      seller: opts.sellerName,
      lines,
      head: headCount,
      total,
      headAfter: count ?? headCount,
    })
    if (res.ok) report.sent.push(p.email)
    else report.failed.push({ to: p.email, error: res.error })
  }
  return report
}

// ─── Cattle sold ─────────────────────────────────────────────────────────────

/**
 * Tell an owner what they sold and what they cleared, and ask what they want
 * done with the money.
 *
 * The third payout option only appears when there is actually something open
 * to settle. Offering to pay an invoice that does not exist is the kind of
 * detail that makes an owner stop trusting the rest of the figures.
 */
export async function notifySale(opts: {
  ownerId: string
  buyerName: string
  lines: SaleLine[]
  fees: AppliedFee[]
  saleId?: string | null
}): Promise<SentReport> {
  const people = await recipientsFor(opts.ownerId, 'sales')
  if (people.length === 0 || opts.lines.length === 0) return empty()

  const supabase = createAdminClient()
  const totals = settleSale(opts.lines, opts.fees)
  const ctx = await context(opts.ownerId)

  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('invoice_number, total_amount, paid_amount')
    .eq('owner_id', opts.ownerId)
    .in('status', ['sent', 'approved'])
    .order('period_start', { ascending: true })

  type Inv = { invoice_number: string | null; total_amount: number | null; paid_amount: number | null }
  const owing = ((openInvoices ?? []) as Inv[])
    .reduce((s, i) => s + ((i.total_amount ?? 0) - (i.paid_amount ?? 0)), 0)
  const firstOpen = ((openInvoices ?? []) as Inv[])[0]

  const money = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const q = opts.saleId ? `&sale=${opts.saleId}` : ''
  const payouts = [
    { key: 'check' as const, label: 'MAIL ME A CHECK',
      sub: `${money(totals.net)} in the post`, href: `${ctx.url}?payout=check${q}` },
    { key: 'buy' as const, label: 'PUT IT TOWARD MORE CATTLE',
      sub: 'Opens a buy request', href: `${ctx.url}?payout=buy${q}` },
    ...(owing > 0 ? [{
      key: 'invoice' as const, label: 'PAY MY OPEN INVOICE FIRST',
      sub: `${money(owing)} on ${firstOpen?.invoice_number ?? 'your account'}, ${money(Math.max(0, totals.net - owing))} to follow`,
      href: `${ctx.url}?payout=invoice${q}`,
    }] : []),
  ]

  const report = empty()
  for (const p of people) {
    const res = await sendSaleEmail(p.email, {
      ...ctx,
      personName: p.name,
      buyer: opts.buyerName,
      lines: opts.lines.map(l => ({
        title: l.what, tagLine: l.tag, detail: lineDetail(l),
        date: l.date, amount: lineAmount(l),
      })),
      head: totals.head,
      gross: totals.gross,
      fees: totals.fees,
      feeTotal: totals.feeTotal,
      net: totals.net,
      payouts,
    })
    if (res.ok) report.sent.push(p.email)
    else report.failed.push({ to: p.email, error: res.error })
  }
  return report
}

/** Both sides of a transfer between two owners, in one call. */
export async function notifyTransfer(opts: {
  fromOwnerId: string | null
  toOwnerId: string | null
  fromName: string
  toName: string
  date: string
  head: PurchasedHead[]
  saleLines: SaleLine[]
  fees: AppliedFee[]
}): Promise<{ buyer: SentReport; seller: SentReport }> {
  const [buyer, seller] = await Promise.all([
    opts.toOwnerId
      ? notifyPurchase({ ownerId: opts.toOwnerId, sellerName: opts.fromName, date: opts.date, head: opts.head })
      : Promise.resolve(empty()),
    opts.fromOwnerId
      ? notifySale({ ownerId: opts.fromOwnerId, buyerName: opts.toName, lines: opts.saleLines, fees: opts.fees })
      : Promise.resolve(empty()),
  ])
  return { buyer, seller }
}

export { fmtDate }
