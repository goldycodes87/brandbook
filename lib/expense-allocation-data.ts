// Loading half of the allocation story: fetch a quarter's expenses and the
// grazing assignments that split them, then hand both to
// lib/expense-allocation.ts.
//
// The invoice route and the live pending view both call loadQuarterAllocations.
// Neither computes anything itself — which is the point. Two copies of this
// query drifting apart is how "pending" and "invoiced" stopped agreeing.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeExpenseAllocations,
  computeHerdDays,
  resolveExpenseKind,
  expenseWindow,
  type Allocation,
  type AllocationAssignment,
  type AllocatableExpense,
  type ExpenseKind,
  type OwnerKey,
} from '@/lib/expense-allocation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, 'public', any>

export interface ExpenseMeta {
  id: string
  description: string | null
  category_name: string | null
  total_amount: number
  expense_date: string | null
  kind: ExpenseKind
  owner_id: string | null
  animal_id: string | null
  is_lease_specific: boolean
  lease_id: string | null
  lease_name: string | null
  /** The window its share was computed over — the honest answer to "% of what period". */
  window_start: string
  window_end: string
}

export interface QuarterAllocations {
  allocations: Allocation[]
  expenses: Map<string, ExpenseMeta>
  unallocated: Array<{ expense_id: string; amount: number; reason: string }>
  /** Herd-days over the quarter itself — the "% of the herd" figure on an invoice. */
  herdDays: { byOwner: Map<OwnerKey, number>; total: number }
}

type ExpenseRow = {
  id: string
  lease_id: string | null
  expense_type: string | null
  category_name: string | null
  description: string | null
  total_amount: number
  owner_id: string | null
  animal_id: string | null
  period_start: string | null
  period_end: string | null
  expense_date: string | null
  include_calves: boolean | null
  is_lease_specific: boolean | null
  expense_categories: { calculation_type: string | null; expense_type: string | null } | null
}

type AssignRow = {
  animal_id: string
  lease_id: string | null
  start_date: string
  end_date: string | null
  animals: { id: string; sex: string | null; owner_id: string | null; weaning_date: string | null; dam_id: string | null } | null
}

const EXPENSE_SELECT =
  'id, lease_id, expense_type, category_name, description, total_amount, owner_id, animal_id, ' +
  'period_start, period_end, expense_date, include_calves, is_lease_specific, ' +
  'expense_categories(calculation_type, expense_type)'

const ASSIGN_SELECT =
  'animal_id, lease_id, start_date, end_date, animals(id, sex, owner_id, weaning_date, dam_id)'

function toAllocatable(r: ExpenseRow): AllocatableExpense {
  return {
    id:                    r.id,
    total_amount:          Number(r.total_amount) || 0,
    expense_type:          r.expense_type,
    category_expense_type: r.expense_categories?.expense_type ?? null,
    calculation_type:      r.expense_categories?.calculation_type ?? null,
    owner_id:              r.owner_id,
    animal_id:             r.animal_id,
    include_calves:        r.include_calves,
    period_start:          r.period_start,
    period_end:            r.period_end,
    expense_date:          r.expense_date,
  }
}

function toAssignment(a: AssignRow): AllocationAssignment {
  return {
    animal_id:    a.animal_id,
    start_date:   a.start_date,
    end_date:     a.end_date,
    owner_id:     a.animals?.owner_id ?? null,
    sex:          a.animals?.sex ?? null,
    weaning_date: a.animals?.weaning_date ?? null,
    dam_id:       a.animals?.dam_id ?? null,
  }
}

/**
 * Widen the assignment fetch to cover every expense window, not just the
 * quarter. A period expense can start before the quarter or run past it, and
 * an assignment that only overlaps that overhang still owes days against it —
 * fetching the quarter alone silently drops them from the denominator.
 */
function assignmentSpan(
  rows: ExpenseRow[],
  qStart: string,
  qEnd: string,
): { start: string; end: string } {
  let start = qStart
  let end   = qEnd
  for (const r of rows) {
    const w = expenseWindow(toAllocatable(r), qStart, qEnd)
    if (w.start < start) start = w.start
    if (w.end   > end)   end   = w.end
  }
  return { start, end }
}

/**
 * Calendar bounds of a quarter, from a two-digit year.
 *
 * Built from local-midnight Dates to match how every existing invoice period
 * was written. Changing it would shift historical period_start/period_end.
 */
export function quarterRange(year2: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3
  const endMonth   = startMonth + 2
  const yy = 2000 + (year2 % 100)
  return {
    start: new Date(yy, startMonth, 1).toISOString().slice(0, 10),
    end:   new Date(yy, endMonth + 1, 0).toISOString().slice(0, 10),
  }
}

/** grazing_owners row flagged is_self — "Legacy (Me)", the ranch's own pocket. */
export async function getSelfOwnerId(supabase: DB): Promise<string | null> {
  const { data } = await supabase
    .from('grazing_owners')
    .select('id')
    .eq('is_self', true)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Every owner's share of every expense in a quarter — whole-herd rows split
 * across the entire herd, lease-specific rows split only across that lease.
 *
 * Nothing here is persisted. Callers decide: the invoice route freezes one
 * owner's rows into expense_allocations; the pending view just reads them.
 */
export async function loadQuarterAllocations(
  supabase: DB,
  opts: { quarter: number; year: number; windowStart: string; windowEnd: string; selfOwnerId?: string | null },
): Promise<QuarterAllocations> {
  const { quarter, year, windowStart, windowEnd } = opts
  const selfOwnerId = opts.selfOwnerId !== undefined
    ? opts.selfOwnerId
    : await getSelfOwnerId(supabase)

  const { data: rawExpenses } = await supabase
    .from('lease_expenses')
    .select(EXPENSE_SELECT)
    .eq('quarter', quarter)
    .eq('year', year % 100)

  // Via `unknown`: the generated types model the expense_categories join as an
  // array, but it is many-to-one so PostgREST returns a single object.
  const allExpenses = (rawExpenses ?? []) as unknown as ExpenseRow[]

  const expenses    = new Map<string, ExpenseMeta>()
  const allocations: Allocation[] = []
  const unallocated: QuarterAllocations['unallocated'] = []

  const span = assignmentSpan(allExpenses, windowStart, windowEnd)

  // Owner per animal, for animal_specific rows whose own owner_id was never
  // stamped (older rows predate that).
  const animalIds = [...new Set(allExpenses.map(e => e.animal_id).filter((x): x is string => !!x))]
  const animalOwners = new Map<string, string | null>()
  if (animalIds.length > 0) {
    const { data: animalRows } = await supabase
      .from('animals')
      .select('id, owner_id')
      .in('id', animalIds)
    for (const a of (animalRows ?? []) as unknown as Array<{ id: string; owner_id: string | null }>) {
      animalOwners.set(a.id, a.owner_id)
    }
  }

  const leaseNames = new Map<string, string>()
  const leaseIds   = [...new Set(allExpenses.filter(e => e.is_lease_specific && e.lease_id).map(e => e.lease_id as string))]
  if (leaseIds.length > 0) {
    const { data: leaseRows } = await supabase
      .from('leases')
      .select('id, property_name')
      .in('id', leaseIds)
    for (const l of (leaseRows ?? []) as unknown as Array<{ id: string; property_name: string }>) {
      leaseNames.set(l.id, l.property_name)
    }
  }

  const record = (rows: ExpenseRow[], leaseId: string | null) => {
    for (const r of rows) {
      const w = expenseWindow(toAllocatable(r), windowStart, windowEnd)
      expenses.set(r.id, {
        id:                r.id,
        description:       r.description,
        category_name:     r.category_name,
        total_amount:      Number(r.total_amount) || 0,
        expense_date:      r.expense_date,
        kind:              resolveExpenseKind(toAllocatable(r)),
        owner_id:          r.owner_id,
        animal_id:         r.animal_id,
        is_lease_specific: Boolean(r.is_lease_specific),
        lease_id:          leaseId,
        lease_name:        leaseId ? (leaseNames.get(leaseId) ?? null) : null,
        window_start:      w.start,
        window_end:        w.end,
      })
    }
  }

  // ── Whole-herd rows: denominator is every animal on every lease ────────────
  const { data: rawAssign } = await supabase
    .from('grazing_assignments')
    .select(ASSIGN_SELECT)
    .lte('start_date', span.end)
    .or(`end_date.is.null,end_date.gte.${span.start}`)

  const assignments = ((rawAssign ?? []) as unknown as AssignRow[]).map(toAssignment)

  // Over the quarter itself, not the widened span — this is the headline
  // "% of the herd", which should not shift because one expense spilled a
  // month either side of the quarter.
  const herdDays = computeHerdDays({ assignments, windowStart, windowEnd, selfOwnerId })

  const wholeHerd = allExpenses.filter(e => !e.is_lease_specific)
  if (wholeHerd.length > 0) {
    const res = computeExpenseAllocations({
      expenses: wholeHerd.map(toAllocatable),
      assignments,
      windowStart,
      windowEnd,
      selfOwnerId,
      animalOwners,
    })
    allocations.push(...res.allocations)
    unallocated.push(...res.unallocated)
    record(wholeHerd, null)
  }

  // ── Lease-specific rows: denominator is that lease only ───────────────────
  const byLease = new Map<string, ExpenseRow[]>()
  for (const e of allExpenses) {
    if (!e.is_lease_specific || !e.lease_id) continue
    const list = byLease.get(e.lease_id) ?? []
    list.push(e)
    byLease.set(e.lease_id, list)
  }

  for (const [leaseId, rows] of byLease) {
    const { data: rawLeaseAssign } = await supabase
      .from('grazing_assignments')
      .select(ASSIGN_SELECT)
      .eq('lease_id', leaseId)
      .lte('start_date', span.end)
      .or(`end_date.is.null,end_date.gte.${span.start}`)

    const leaseAssignments = ((rawLeaseAssign ?? []) as unknown as AssignRow[]).map(toAssignment)

    const res = computeExpenseAllocations({
      expenses: rows.map(toAllocatable),
      assignments: leaseAssignments,
      windowStart,
      windowEnd,
      selfOwnerId,
      animalOwners,
    })
    allocations.push(...res.allocations)
    unallocated.push(...res.unallocated)
    record(rows, leaseId)
  }

  // A row flagged lease-specific with no lease belongs to neither pass. There
  // is no herd to split it across, so it is surfaced rather than dropped —
  // silently vanishing money is the exact failure this table exists to end.
  const orphans = allExpenses.filter(e => e.is_lease_specific && !e.lease_id)
  if (orphans.length > 0) {
    record(orphans, null)
    for (const o of orphans) {
      unallocated.push({
        expense_id: o.id,
        amount:     Number(o.total_amount) || 0,
        reason:     'marked lease-specific but has no lease',
      })
    }
  }

  return { allocations, expenses, unallocated, herdDays }
}
