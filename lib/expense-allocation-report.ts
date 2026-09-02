// Every owner's share of every expense in a quarter, with a status on each:
// pending -> invoiced -> paid.
//
// Two sources, deliberately different in kind:
//   - invoiced/paid shares are READ from expense_allocations. They were frozen
//     when the invoice was cut and must never move afterwards.
//   - pending shares are COMPUTED live from current herd-days. Storing them
//     would freeze a number that changes the moment an animal moves pasture.
//
// Both the operator view and the owner portal call buildAllocationReport, so
// an owner and Grant are always looking at the same arithmetic.

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadQuarterAllocations, quarterRange, getSelfOwnerId, type ExpenseMeta } from '@/lib/expense-allocation-data'
import type { Allocation, ExpenseKind, OwnerKey } from '@/lib/expense-allocation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, 'public', any>

export type AllocationStatus = 'pending' | 'invoiced' | 'paid'

export interface AllocationRow {
  expense_id: string
  owner_id: OwnerKey
  owner_name: string
  description: string
  category_name: string | null
  expense_date: string | null
  lease_name: string | null
  kind: ExpenseKind
  /** The whole expense, before anyone's share is taken out. */
  expense_total: number
  amount: number
  share_note: string | null
  status: AllocationStatus
  invoice_id: string | null
  invoice_number: string | null
}

export interface OwnerSummary {
  owner_id: OwnerKey
  owner_name: string
  pending: number
  invoiced: number
  paid: number
  total: number
}

export interface AllocationReport {
  quarter: number
  year: number
  period: { start: string; end: string }
  rows: AllocationRow[]
  owners: OwnerSummary[]
  totals: { pending: number; invoiced: number; paid: number; total: number }
  /** Expenses whose money landed in nobody's column — worth showing, not swallowing. */
  unallocated: Array<{ expense_id: string; description: string; amount: number; reason: string }>
}

type StoredAllocation = {
  expense_id: string
  owner_id: string | null
  amount: number
  share_note: string | null
  invoice_id: string | null
  invoices: { id: string; invoice_number: string | null; status: string | null } | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const keyOf  = (expenseId: string, ownerId: OwnerKey) => `${expenseId}::${ownerId ?? 'ranch'}`

function describe(meta: ExpenseMeta): string {
  return meta.description || meta.category_name || 'Expense'
}

export async function buildAllocationReport(
  supabase: DB,
  opts: { quarter: number; year: number; ownerId?: string | null },
): Promise<AllocationReport> {
  const quarter = opts.quarter
  const year    = opts.year % 100
  const period  = quarterRange(year, quarter)

  const { allocations, expenses, unallocated } = await loadQuarterAllocations(supabase, {
    quarter,
    year,
    windowStart: period.start,
    windowEnd:   period.end,
  })

  // ── Frozen shares ─────────────────────────────────────────────────────────
  const expenseIds = [...expenses.keys()]
  const stored = new Map<string, StoredAllocation>()

  if (expenseIds.length > 0) {
    const { data } = await supabase
      .from('expense_allocations')
      .select('expense_id, owner_id, amount, share_note, invoice_id, invoices(id, invoice_number, status)')
      .in('expense_id', expenseIds)

    // Via `unknown`: the generated types model the invoices join as an array,
    // but it is many-to-one so PostgREST returns a single object.
    for (const s of (data ?? []) as unknown as StoredAllocation[]) {
      stored.set(keyOf(s.expense_id, s.owner_id), s)
    }
  }

  // ── Owner names ───────────────────────────────────────────────────────────
  const { data: ownerRows } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name, is_self')

  const ownerNames = new Map<OwnerKey, string>()
  for (const o of (ownerRows ?? []) as unknown as Array<{
    id: string; name: string | null; company_name: string | null; owner_name: string | null; is_self: boolean | null
  }>) {
    ownerNames.set(o.id, o.company_name || o.owner_name || o.name || 'Unnamed owner')
  }
  // Ranch-owned animals with no is_self row configured still need a label.
  ownerNames.set(null, 'Legacy (Me)')

  // ── Merge ─────────────────────────────────────────────────────────────────
  //
  // A frozen row wins over the live computation for its (expense, owner). It
  // records what was actually billed; recomputing it would quietly restate a
  // sent invoice.
  const rows: AllocationRow[] = []
  const seen = new Set<string>()

  const push = (
    expenseId: string,
    ownerId: OwnerKey,
    amount: number,
    shareNote: string | null,
    frozen: StoredAllocation | undefined,
  ) => {
    const meta = expenses.get(expenseId)
    if (!meta) return

    const invoiceStatus = frozen?.invoices?.status ?? null
    const status: AllocationStatus = !frozen || !frozen.invoice_id
      ? 'pending'
      : invoiceStatus === 'paid' ? 'paid' : 'invoiced'

    rows.push({
      expense_id:     expenseId,
      owner_id:       ownerId,
      owner_name:     ownerNames.get(ownerId) ?? 'Unknown owner',
      description:    describe(meta),
      category_name:  meta.category_name,
      expense_date:   meta.expense_date,
      lease_name:     meta.lease_name,
      kind:           meta.kind,
      expense_total:  round2(meta.total_amount),
      amount:         round2(amount),
      share_note:     shareNote,
      status,
      invoice_id:     frozen?.invoice_id ?? null,
      invoice_number: frozen?.invoices?.invoice_number ?? null,
    })
  }

  for (const alloc of allocations as Allocation[]) {
    const k      = keyOf(alloc.expense_id, alloc.owner_id)
    const frozen = stored.get(k)
    seen.add(k)
    push(
      alloc.expense_id,
      alloc.owner_id,
      frozen ? Number(frozen.amount) : alloc.amount,
      frozen ? frozen.share_note : alloc.share_note,
      frozen,
    )
  }

  // A frozen share whose owner no longer has animal-days — the herd moved after
  // the invoice went out. It was billed, so it still belongs on the report.
  for (const [k, s] of stored) {
    if (seen.has(k)) continue
    push(s.expense_id, s.owner_id, Number(s.amount), s.share_note, s)
  }

  const filtered = opts.ownerId ? rows.filter(r => r.owner_id === opts.ownerId) : rows

  filtered.sort((a, b) =>
    (b.expense_date ?? '').localeCompare(a.expense_date ?? '') ||
    a.description.localeCompare(b.description) ||
    a.owner_name.localeCompare(b.owner_name)
  )

  // ── Roll up ───────────────────────────────────────────────────────────────
  const byOwner = new Map<OwnerKey, OwnerSummary>()
  const totals  = { pending: 0, invoiced: 0, paid: 0, total: 0 }

  for (const r of filtered) {
    const s = byOwner.get(r.owner_id) ?? {
      owner_id: r.owner_id, owner_name: r.owner_name,
      pending: 0, invoiced: 0, paid: 0, total: 0,
    }
    s[r.status] += r.amount
    s.total     += r.amount
    byOwner.set(r.owner_id, s)

    totals[r.status] += r.amount
    totals.total     += r.amount
  }

  for (const s of byOwner.values()) {
    s.pending  = round2(s.pending)
    s.invoiced = round2(s.invoiced)
    s.paid     = round2(s.paid)
    s.total    = round2(s.total)
  }

  return {
    quarter,
    year,
    period,
    rows: filtered,
    owners: [...byOwner.values()].sort((a, b) => a.owner_name.localeCompare(b.owner_name)),
    totals: {
      pending:  round2(totals.pending),
      invoiced: round2(totals.invoiced),
      paid:     round2(totals.paid),
      total:    round2(totals.total),
    },
    unallocated: opts.ownerId ? [] : unallocated.map(u => ({
      expense_id:  u.expense_id,
      description: expenses.get(u.expense_id) ? describe(expenses.get(u.expense_id)!) : 'Expense',
      amount:      round2(u.amount),
      reason:      u.reason,
    })),
  }
}

// ─── Receivable ─────────────────────────────────────────────────────────────

export interface PendingReceivable {
  /** Owed by outside owners and not yet on any invoice. */
  total: number
  byQuarter: Array<{ year: number; quarter: number; pending: number }>
  /** Quarters older than the window below, if any were skipped. */
  quartersConsidered: number
}

/**
 * What outside owners owe that nobody has invoiced yet.
 *
 * THE one implementation. Every screen showing an unbilled figure calls this,
 * because the alternative has already been tried: the dashboard and the admin
 * overview each ran `sum(total_amount) where invoice_id is null` over
 * lease_expenses, and both were wrong in the same three ways.
 *
 *   1. invoice_id is only ever stamped on owner_specific and animal_specific
 *      rows. Shared costs — hay, mineral, a branding day — are tracked through
 *      expense_allocations, so they read as uninvoiced forever. That query
 *      counted money Andy and Doug had already paid.
 *   2. It spanned every quarter at once while billing runs per quarter.
 *   3. It included the is_self owner, which is the ranch's own pocket and can
 *      never be a receivable.
 *
 * Pending is computed from live herd-days rather than stored, so this is the
 * same arithmetic an invoice would use if it were cut right now.
 */
export async function pendingReceivable(
  supabase: DB,
  opts: { maxQuarters?: number } = {},
): Promise<PendingReceivable> {
  const maxQuarters = opts.maxQuarters ?? 8

  const [{ data: periodRows }, selfOwnerId] = await Promise.all([
    supabase.from('lease_expenses').select('year, quarter'),
    getSelfOwnerId(supabase),
  ])

  const periods = [
    ...new Set(
      ((periodRows ?? []) as Array<{ year: number | null; quarter: number | null }>)
        .filter(r => r.year != null && r.quarter != null)
        .map(r => `${r.year}:${r.quarter}`),
    ),
  ]
    .map(k => {
      const [y, q] = k.split(':').map(Number)
      return { year: y, quarter: q }
    })
    // Newest first, so a long history is trimmed from the far end rather than
    // silently dropping the quarter about to be billed.
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter)

  const considered = periods.slice(0, maxQuarters)

  const reports = await Promise.all(
    considered.map(p => buildAllocationReport(supabase, { quarter: p.quarter, year: p.year })),
  )

  const byQuarter = reports.map((r, i) => ({
    year:    considered[i].year,
    quarter: considered[i].quarter,
    // The ranch's own share is not owed to anyone. Ranch-owned animals resolve
    // to the is_self owner, and to a null key when no is_self row exists.
    pending: round2(
      r.owners
        .filter(o => o.owner_id !== null && o.owner_id !== selfOwnerId)
        .reduce((s, o) => s + o.pending, 0),
    ),
  }))

  return {
    total:              round2(byQuarter.reduce((s, q) => s + q.pending, 0)),
    byQuarter:          byQuarter.filter(q => q.pending !== 0),
    quartersConsidered: considered.length,
  }
}
