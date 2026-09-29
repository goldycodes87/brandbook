import type { Allocation } from '@/lib/expense-allocation'
import type { ExpenseMeta } from '@/lib/expense-allocation-data'

export type LineItem = {
  description: string
  quantity: number | null
  unit_price: number | null
  amount: number
  /** Section title. Carries no money. */
  is_header?: boolean
  /**
   * Section subtotal. Carries the section's money, which is ALSO in the lines
   * above it — so anything summing an invoice must skip these, or it charges
   * everything twice. See invoiceTotal().
   */
  is_subtotal?: boolean
  share_note?: string
  expense_type?: string
  is_whole_herd?: boolean
}

/**
 * What an invoice comes to.
 *
 * The one place that adds line items up. Headers carry no money and subtotals
 * carry money that is already counted in the lines above them, so a naive
 * reduce over the array bills the expenses twice — the sort of arithmetic that
 * is obvious in hindsight and invisible on a page.
 */
export function invoiceTotal(
  items: Array<{ amount?: number | null; is_header?: boolean; is_subtotal?: boolean }>,
): number {
  return round2(
    items
      .filter(i => !i.is_header && !i.is_subtotal)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0),
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100
const usd    = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

/**
 * Collapse an owner's shares into one line per category, in one shape.
 *
 * Every line carries the same three numbers, because a column that is filled
 * on some rows and a dash on others makes a reader check each row to find out
 * which kind it is:
 *
 *   QTY      how many charges went into the category
 *   COST EA  what the ranch paid per charge  (pool / qty)
 *   TOTAL    what THIS owner owes of it
 *
 * Qty x Cost Ea is what the place spent; Total is the share of it. Those two
 * are equal for an owner's own work and differ for anything split across the
 * herd, and the gap is explained once in the section title — "41.8% of herd"
 * — rather than restated on every line.
 *
 * The average unit cost is honest here only BECAUSE the percentage is stated:
 * 9 x $305.33 is the $2,748 of hay that was bought, and 41.8% of it is the
 * $1,148.77 owed. On a page with no percentage on it, that average would be a
 * number reconciling against nothing, which is why it is not computed there.
 */
export function groupIntoLineItems(
  rows: Array<{ alloc: Allocation; meta: ExpenseMeta }>,
  leaseName?: string,
): LineItem[] {
  const byCategory = new Map<string, Array<{ alloc: Allocation; meta: ExpenseMeta }>>()
  for (const r of rows) {
    const key = r.meta.category_name?.trim() || r.meta.description?.trim() || 'Expense'
    const list = byCategory.get(key) ?? []
    list.push(r)
    byCategory.set(key, list)
  }

  const out: LineItem[] = []

  for (const [category, group] of byCategory) {
    const qty   = group.length
    const total = round2(group.reduce((s, g) => s + g.alloc.amount, 0))
    const pool  = round2(group.reduce((s, g) => s + Number(g.meta.total_amount || 0), 0))
    const kind  = group[0].alloc.kind

    // One charge keeps its own description — 'AI tech fee - Poss Winchester'
    // names the bull, and 'AI Technician Fee' with a qty of 1 does not.
    const base  = qty === 1 ? (group[0].meta.description?.trim() || category) : category
    const label = leaseName ? `${base} (${leaseName})` : base

    const shared = kind === 'shared' && round2(pool - total) !== 0
    const pct    = pool > 0 ? Math.round((total / pool) * 1000) / 10 : null

    out.push({
      description:  label,
      quantity:     qty,
      unit_price:   round2(pool / qty),
      amount:       total,
      expense_type: kind,
      ...(shared && pct !== null ? { share_note: `${pct}% of ${usd(pool)}` } : {}),
      ...(group[0].meta.is_lease_specific ? {} : { is_whole_herd: true }),
    })
  }

  // Biggest first — what somebody queries on a bill is the big number.
  return out.sort((a, b) => b.amount - a.amount)
}

export function buildExpenseSections(
  rows: Array<{ alloc: Allocation; meta: ExpenseMeta }>,
  opts: {
    quarter: number
    year: number
    /** Share of herd-days, 0-100. Shown in the herd section's title. */
    herdPct: number | null
    /** animal_id -> ear tag, so per-animal work says which animal. */
    tags?: Map<string, string>
  },
): LineItem[] {
  const shared = rows.filter(r => r.alloc.kind === 'shared')
  const own    = rows.filter(r => r.alloc.kind !== 'shared')

  const out: LineItem[] = []

  const section = (title: string, items: LineItem[]) => {
    if (items.length === 0) return
    out.push({ description: title, quantity: null, unit_price: null, amount: 0, is_header: true })
    out.push(...items)
    out.push({
      description: 'Subtotal',
      quantity:    null,
      unit_price:  null,
      amount:      round2(items.reduce((s, i) => s + i.amount, 0)),
      is_subtotal: true,
    })
  }

  const pct = opts.herdPct != null ? `${Math.round(opts.herdPct * 10) / 10}% of herd` : 'share of herd'
  section(
    `HERD EXPENSES (${pct} for Q${opts.quarter} ${2000 + (opts.year % 100)})`,
    groupIntoLineItems(shared),
  )

  // The tag goes on per-animal work: "Vet Visit (#41)" answers the question a
  // person actually has, which is which animal they are paying for.
  const ownItems = groupIntoLineItems(own).map(item => {
    const match = own.filter(r =>
      (r.meta.category_name?.trim() || r.meta.description?.trim() || 'Expense') === item.description ||
      r.meta.description?.trim() === item.description)
    const tags = [...new Set(
      match.map(r => (r.meta.animal_id ? opts.tags?.get(r.meta.animal_id) : null)).filter(Boolean),
    )] as string[]
    if (tags.length === 0 || tags.length > 3) return item
    return { ...item, description: `${item.description} (${tags.map(t => `#${t}`).join(', ')})` }
  })

  section('OWNER SPECIFIC', ownItems)

  return out
}
