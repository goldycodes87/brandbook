/**
 * What a sale costs, and how each head was priced.
 *
 * ── Fees are a checklist, not a formula ───────────────────────────────────
 *
 * The old code charged every sale a flat percentage and called it done. That
 * is wrong in both directions. Andy sold four head to Doug and the cattle
 * never left the place — no hauling, no yardage, no commission, because there
 * was no sale barn in it. The same percentage applied to a load that went to
 * Calhan would have missed the brand inspection and the checkoff.
 *
 * So every fee is a line the admin turns on or off for that sale, with a rate
 * he can change. Defaults are what usually applies at a Colorado sale barn;
 * the ones that depend on the cattle actually moving start off.
 *
 * ── Pairs and bred cows go by the head ────────────────────────────────────
 *
 * A pair or a bred cow is sold as an animal: one price, agreed. A calf, a
 * steer or an open cow is sold by the pound. Pricing a bred cow per pound
 * prices her as beef and ignores what she is carrying, which is most of what
 * she is worth.
 */

export type PriceBasis = 'head' | 'pound'

export type FeeBasis = 'pct_of_gross' | 'per_head' | 'flat' | 'min_plus_per_head'

export interface FeeDef {
  key: string
  label: string
  basis: FeeBasis
  /**
   * Percent for pct_of_gross, dollars for per_head and flat. For
   * min_plus_per_head it is the minimum, which covers the first `covers` head.
   */
  rate: number
  /** min_plus_per_head only: how many head the minimum covers. */
  covers?: number
  /** min_plus_per_head only: the charge for each head beyond that. */
  perHeadOver?: number
  /** Whether it starts ticked when a sale is being written up. */
  on: boolean
  hint: string
}

/**
 * The checklist.
 *
 * Order is the order it is read in — what the barn takes first, then the
 * per-head charges, then anything that only applies if the cattle moved.
 */
export const SALE_FEES: FeeDef[] = [
  { key: 'commission',       label: 'Commission',            basis: 'pct_of_gross', rate: 3,    on: true,  hint: 'The barn’s cut of the gross.' },
  { key: 'yardage',          label: 'Yardage',               basis: 'per_head',     rate: 5,    on: true,  hint: 'Pen space and feed at the barn.' },
  { key: 'insurance',        label: 'Insurance',             basis: 'pct_of_gross', rate: 0.25, on: true,  hint: 'Covers the cattle while the barn has them.' },
  // Required in Colorado, but who pays for it is negotiated per sale, so it
  // starts off rather than quietly landing on the seller. $40 minimum covers
  // the first three head; $1.25 each after that.
  { key: 'brand_inspection', label: 'Brand inspection',      basis: 'min_plus_per_head', rate: 40, covers: 3, perHeadOver: 1.25, on: false, hint: '$40 minimum covers 3 head, then $1.25 each. Legally required — but agree who pays before you tick it.' },
  { key: 'beef_checkoff',    label: 'Beef checkoff',         basis: 'per_head',     rate: 1,    on: true,  hint: 'A dollar a head, required on every sale.' },
  { key: 'hauling',          label: 'Hauling',               basis: 'flat',         rate: 0,    on: false, hint: 'Off unless the cattle actually left the place.' },
  { key: 'vet_health',       label: 'Vet and health papers', basis: 'flat',         rate: 0,    on: false, hint: 'Health certificate, testing, haul-in exam.' },
  { key: 'private_sale_fee', label: 'Private sale fee',      basis: 'flat',         rate: 350,  on: false, hint: 'Flat charge on a private treaty sale, in place of commission.' },
]

/** One fee as it stands on a particular sale. */
export interface AppliedFee {
  key: string
  label: string
  basis: FeeBasis
  rate: number
  covers?: number
  perHeadOver?: number
  on: boolean
}

/** The checklist as it starts, before the admin touches it. */
export function defaultFees(): AppliedFee[] {
  return SALE_FEES.map(f => ({
    key: f.key, label: f.label, basis: f.basis, rate: f.rate,
    covers: f.covers, perHeadOver: f.perHeadOver, on: f.on,
  }))
}

/**
 * How this animal should be priced, unless somebody says otherwise.
 *
 * `bred` is whatever the ranch last recorded: a preg check that came back
 * bred, or an expected calving date still ahead. A pair is a cow with a calf
 * at side, which is sold as one thing.
 */
export function defaultBasis(a: {
  sex?: string | null
  isPair?: boolean | null
  bred?: boolean | null
}): PriceBasis {
  if (a.isPair) return 'head'
  if (a.bred)   return 'head'

  const sex = (a.sex ?? '').toLowerCase()
  // A bull is the other animal sold as an animal -- nobody prices a herd bull
  // by the pound unless he is going to slaughter, and then he is a cull.
  if (sex === 'bull') return 'head'

  return 'pound'
}

export interface SaleLine {
  /** What it is, in words: 'Yellow pair', 'Bull calf'. */
  what: string
  tag: string
  date: string
  basis: PriceBasis
  /** Head covered by this line. A pair is one line and two head. */
  head: number
  weightLbs?: number | null
  pricePerLb?: number | null
  pricePerHead?: number | null
}

/** What a line brought, from its own basis. Rounded to the cent. */
export function lineAmount(l: SaleLine): number {
  const raw = l.basis === 'pound'
    ? (l.weightLbs ?? 0) * (l.pricePerLb ?? 0)
    : (l.pricePerHead ?? 0)
  return Math.round(raw * 100) / 100
}

/** How the line reads under its own description. */
export function lineDetail(l: SaleLine): string {
  if (l.basis === 'pound') {
    const w = l.weightLbs ? `${l.weightLbs.toLocaleString('en-US')} lb` : 'weight not recorded'
    return l.pricePerLb ? `${w} at $${l.pricePerLb.toFixed(2)}/lb` : w
  }
  return l.head > 1 ? `By the head, ${l.head} head` : 'By the head'
}

export interface SaleTotals {
  gross: number
  head: number
  fees: Array<{ label: string; amount: number }>
  feeTotal: number
  net: number
}

/**
 * Gross, every fee that is switched on, and what is left.
 *
 * A fee switched on at a rate of zero is dropped rather than printed as
 * "-$0.00", which reads like a mistake on an owner's statement.
 */
export function settleSale(lines: SaleLine[], fees: AppliedFee[]): SaleTotals {
  const gross = Math.round(lines.reduce((s, l) => s + lineAmount(l), 0) * 100) / 100
  const head  = lines.reduce((s, l) => s + l.head, 0)
  return { gross, head, ...applyFees(gross, head, fees) }
}

/**
 * The fee half, against a gross and a head count that are already known.
 *
 * Split out so the checklist in the sale sheet can price itself as the
 * operator ticks boxes, without inventing a second copy of the arithmetic.
 * What he sees while deciding is what the email says afterwards.
 */
export function applyFees(gross: number, head: number, fees: AppliedFee[]) {
  const out: Array<{ label: string; amount: number }> = []
  for (const f of fees) {
    if (!f.on || !f.rate) continue

    const amount =
      f.basis === 'pct_of_gross'      ? gross * f.rate / 100
      : f.basis === 'per_head'        ? f.rate * head
      // A minimum that covers the first few head, then a charge for each one
      // beyond. A small sale pays the minimum and nothing more.
      : f.basis === 'min_plus_per_head'
        ? f.rate + Math.max(0, head - (f.covers ?? 0)) * (f.perHeadOver ?? 0)
      : f.rate

    const rounded = Math.round(amount * 100) / 100
    if (rounded === 0) continue

    const over = Math.max(0, head - (f.covers ?? 0))
    const label =
      f.basis === 'pct_of_gross'      ? `${f.label} (${f.rate}%)`
      : f.basis === 'per_head'        ? `${f.label} (${head} head)`
      : f.basis === 'min_plus_per_head'
        ? (over > 0
            ? `${f.label} ($${f.rate} min + ${over} head)`
            : `${f.label} ($${f.rate} minimum)`)
      : f.label

    out.push({ label, amount: rounded })
  }

  const feeTotal = Math.round(out.reduce((s, f) => s + f.amount, 0) * 100) / 100
  return { fees: out, feeTotal, net: Math.round((gross - feeTotal) * 100) / 100 }
}

/**
 * The fees that make sense for cattle that never left the place.
 *
 * An internal transfer between two owners on the same lease goes through no
 * barn: no commission, no yardage, no insurance, no hauling. The brand
 * inspection and the checkoff still apply, because the cattle changed hands —
 * but they stay unticked, since who pays is agreed per deal.
 */
const BARN_ONLY = new Set(['commission', 'yardage', 'insurance', 'hauling', 'private_sale_fee'])

export function feesForInternalTransfer(fees: AppliedFee[]): AppliedFee[] {
  return fees.map(f => (BARN_ONLY.has(f.key) ? { ...f, on: false } : f))
}
