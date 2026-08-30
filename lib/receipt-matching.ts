// Deciding whether a receipt line is something already written down.
//
// QuickBooks matches receipts against a BANK FEED it does not control, which
// is why its date signal is weak: the purchase date and the settlement date
// differ by days, and the merchant string on the feed is the card processor's,
// not the store's. It leans on amount and treats date as a loose window.
//
// Our problem is the easier one. We match against expenses the operator typed
// himself, usually the same day. So date is a STRONG signal here, and the
// tiers below lead with it. Amount then confirms.
//
// Nothing in this file touches the database or the clock.

export type MatchDecision = 'pending' | 'create' | 'attach' | 'skip'

export interface MatchCandidate {
  id: string
  /** Set when this row is one animal's share of a split. */
  split_group_id: string | null
  /**
   * For a split, the WHOLE expense — every member's share added back up. A
   * $2,100 AI fee across 12 head is twelve $175 rows; comparing a receipt to
   * $175 would never match, so the group total is what is compared.
   */
  amount: number
  /** expense_date, or period_start when the row carries no single date. */
  date: string | null
  description: string | null
  category_name: string | null
  vendor: string | null
  /** Already reconciled to a receipt — matching it again would double-attach. */
  has_receipt: boolean
}

export interface MatchInput {
  amount: number
  /** The receipt's date, which is the purchase date. */
  date: string | null
  description?: string | null
  vendor?: string | null
}

export interface MatchResult {
  candidate: MatchCandidate | null
  /** 0-100. >= AUTO_MATCH_SCORE is safe to preselect. */
  score: number
  reason: string
  /** Everything considered, best first — the operator may pick another. */
  alternatives: Array<{ candidate: MatchCandidate; score: number; reason: string }>
}

/** At or above this, the line is preselected as "already recorded". */
export const AUTO_MATCH_SCORE = 80
/** Below this a candidate is not worth showing at all. */
export const MIN_SHOW_SCORE = 40

const DAY = 86_400_000

export function daysApart(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round(Math.abs(da - db) / DAY)
}

/** Cents, so 0.1 + 0.2 never decides whether an expense matches. */
const cents = (n: number) => Math.round(n * 100)

function amountCloseness(a: number, b: number): 'exact' | 'near' | 'off' {
  const ca = cents(a), cb = cents(b)
  if (ca === cb) return 'exact'
  // A dollar, or 1% on larger amounts — covers tax and rounding without
  // letting two genuinely different purchases collide.
  const tolerance = Math.max(100, Math.round(Math.abs(cb) * 0.01))
  return Math.abs(ca - cb) <= tolerance ? 'near' : 'off'
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Loose containment either way — "Hay" against "3X4X8 GRASS HAY". */
function textOverlaps(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalize(a), nb = normalize(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na)
}

/**
 * Score one candidate against one receipt line.
 *
 * Date leads, amount confirms, vendor and description only ever promote — a
 * disagreement on either is not evidence against a match, because vendor is
 * blank on every expense entered before receipts existed.
 */
export function scoreCandidate(line: MatchInput, c: MatchCandidate): { score: number; reason: string } {
  const amt = amountCloseness(line.amount, c.amount)
  if (amt === 'off') return { score: 0, reason: 'amount differs' }

  const gap = line.date && c.date ? daysApart(line.date, c.date) : null

  let score: number
  let reason: string

  if (gap === 0 && amt === 'exact') {
    score = 95; reason = 'same date, same amount'
  } else if (gap !== null && gap <= 3 && amt === 'exact') {
    score = 85; reason = `exact amount, ${gap} day${gap === 1 ? '' : 's'} apart`
  } else if (gap === 0 && amt === 'near') {
    score = 75; reason = 'same date, amount within a dollar'
  } else if (gap !== null && gap <= 3 && amt === 'near') {
    score = 60; reason = `amount within a dollar, ${gap} days apart`
  } else if (gap !== null && gap <= 14 && amt === 'exact') {
    score = 50; reason = `exact amount, ${gap} days apart`
  } else if (gap === null && amt === 'exact') {
    score = 45; reason = 'exact amount, no date to compare'
  } else {
    return { score: 0, reason: 'too far apart' }
  }

  // Vendor is the strongest confirmation we have once it is populated.
  if (line.vendor && c.vendor && textOverlaps(line.vendor, c.vendor)) {
    score = Math.min(100, score + 10)
    reason += ', same vendor'
  }
  if (textOverlaps(line.description, c.description) || textOverlaps(line.description, c.category_name)) {
    score = Math.min(100, score + 5)
    reason += ', description agrees'
  }

  // Something already reconciled is a weaker candidate than something not.
  // Not disqualifying: a receipt can legitimately cover two lines.
  if (c.has_receipt) {
    score -= 15
    reason += ', already has a receipt'
  }

  return { score, reason }
}

/**
 * Best match for a receipt line, if any.
 *
 * One candidate per split group: the group is one expense, and offering its
 * twelve rows separately would ask the operator to pick a twelfth at random.
 */
export function matchReceiptLine(line: MatchInput, candidates: MatchCandidate[]): MatchResult {
  const bestPerGroup = new Map<string, { candidate: MatchCandidate; score: number; reason: string }>()

  for (const c of candidates) {
    const { score, reason } = scoreCandidate(line, c)
    if (score < MIN_SHOW_SCORE) continue

    const key = c.split_group_id ?? c.id
    const existing = bestPerGroup.get(key)
    if (!existing || score > existing.score) bestPerGroup.set(key, { candidate: c, score, reason })
  }

  const ranked = [...bestPerGroup.values()].sort(
    (a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id),
  )

  if (ranked.length === 0) {
    return { candidate: null, score: 0, reason: 'nothing already recorded looks like this', alternatives: [] }
  }

  const [best, ...rest] = ranked
  return { candidate: best.candidate, score: best.score, reason: best.reason, alternatives: rest }
}

/**
 * What the review queue should preselect.
 *
 * Only a confident match preselects "attach". Everything else defaults to
 * creating a new expense, because a missed match costs one correction and a
 * wrong auto-attach hides a real expense.
 */
export function defaultDecision(result: MatchResult): MatchDecision {
  return result.score >= AUTO_MATCH_SCORE ? 'attach' : 'create'
}
