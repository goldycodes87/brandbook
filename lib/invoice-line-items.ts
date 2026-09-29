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
 * Collapse an owner's shares into one line per category.
 *
 * An invoice listing "Semen straw — SEO Hot Lava  $25.00" five times running
 * is a receipt, not a bill. A bill says "Semen Straws, 6 @ $25.00, $150.00"
 * and lets the reader check it in one glance.
 *
 * Two shapes come out of this, because two genuinely different things are
 * being billed:
 *
 *   Uniform — every share in the category is the same amount, which is what
 *   per-head work looks like: six AI fees at $175. Billed the way anybody
 *   would expect, quantity by unit price.
 *
 *   Pro-rata — hay bought seven times at seven prices, each split by
 *   herd-days. There is no honest unit price for that, so the line carries
 *   the count and the total and says what it is a share OF. Inventing an
 *   average unit price would be a number that reconciles against nothing.
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
    const amounts = group.map(g => round2(g.alloc.amount))
    const total   = round2(amounts.reduce((s, a) => s + a, 0))
    const kind    = group[0].alloc.kind
    const label   = leaseName ? `${category} (${leaseName})` : category

    const uniform = amounts.length > 1 && amounts.every(a => a === amounts[0])

    if (amounts.length === 1) {
      const only = group[0]
      out.push({
        description:  only.meta.description?.trim() || category,
        quantity:     1,
        unit_price:   total,
        amount:       total,
        expense_type: kind,
        ...(only.alloc.share_note ? { share_note: only.alloc.share_note } : {}),
        ...(only.meta.is_lease_specific ? {} : { is_whole_herd: true }),
      })
      continue
    }

    if (uniform) {
      out.push({
        description:  label,
        quantity:     amounts.length,
        unit_price:   amounts[0],
        amount:       total,
        expense_type: kind,
        ...(group[0].meta.is_lease_specific ? {} : { is_whole_herd: true }),
      })
      continue
    }

    // Pro-rata: count and total, plus what the pool was and the share taken.
    const pool = round2(group.reduce((s, g) => s + Number(g.meta.total_amount || 0), 0))
    const pct  = pool > 0 ? Math.round((total / pool) * 1000) / 10 : null
    out.push({
      description:  label,
      quantity:     amounts.length,
      unit_price:   null,
      amount:       total,
      expense_type: kind,
      share_note: kind === 'shared' && pct !== null
        ? `${pct}% share of ${usd(pool)} across ${amounts.length} purchases`
        : `${amounts.length} charges`,
      ...(group[0].meta.is_lease_specific ? {} : { is_whole_herd: true }),
    })
  }

  // Biggest first — what somebody queries on a bill is the big number.
  return out.sort((a, b) => b.amount - a.amount)
}

/**
 * An owner's expense shares, laid out the way a bill is read: sections with a
 * subtotal under each, not one flat run of numbers.
 *
 * Split by what KIND of cost it is, because the two answer different
 * questions. Herd expenses are "your share of what the place spent", and the
 * only number that matters for checking them is the percentage — so it goes
 * in the section title, once, instead of being repeated down the page. Owner
 * specific is "work done on your animals", where the animal is the thing
 * worth naming.
 */
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
