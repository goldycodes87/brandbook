// Who owes what on every expense.
//
// This is the ONE implementation of the pro-rata split. It used to live inline
// in app/api/billing/generate-quarterly/route.ts, where only the invoice could
// see it — so "Andy's pending portion of the hay" was not a number anything
// could look up. Both invoicing and the live pending view now call in here, so
// a share can never mean one thing on an invoice and another on a screen.
//
// Nothing in this file touches the database or the clock. Callers fetch the
// rows, call computeExpenseAllocations, and decide what to persist.

import { calcOverlapDays } from '@/lib/lease-calculations'

/** Ranch-owned animals (owner_id null) bill to the `is_self` owner, "Legacy (Me)". */
export type OwnerKey = string | null

export type ExpenseKind = 'owner_specific' | 'animal_specific' | 'shared'

export interface AllocationAssignment {
  animal_id: string
  start_date: string
  end_date: string | null
  /** Owner of the animal at query time. null = ranch-owned. */
  owner_id: string | null
  sex: string | null
  weaning_date: string | null
  dam_id: string | null
}

export interface AllocatableExpense {
  id: string
  total_amount: number
  /** Falls back to 'shared' when neither the row nor its category says. */
  expense_type?: string | null
  /** expense_categories.expense_type — wins over the row's own column. */
  category_expense_type?: string | null
  /** expense_categories.calculation_type: 'one_time' uses expense_date as the window. */
  calculation_type?: string | null
  owner_id?: string | null
  animal_id?: string | null
  include_calves?: boolean | null
  period_start?: string | null
  period_end?: string | null
  expense_date?: string | null
}

export interface Allocation {
  expense_id: string
  /** Already normalized: ranch-owned resolves to selfOwnerId when one exists. */
  owner_id: OwnerKey
  amount: number
  share_note: string | null
  kind: ExpenseKind
  /** Animal-days behind the share. 0 for owner/animal-specific. */
  days: number
  /** Animal-days behind the whole expense. 0 for owner/animal-specific. */
  total_days: number
}

export interface AllocationInput {
  expenses: AllocatableExpense[]
  /**
   * The assignments that define the denominator. For whole-herd expenses pass
   * every assignment overlapping the quarter; for lease-specific expenses pass
   * only that lease's. Getting this set wrong is the difference between an
   * owner paying a herd share and a lease share.
   */
  assignments: AllocationAssignment[]
  /** Quarter bounds, used when an expense carries no window of its own. */
  windowStart: string
  windowEnd: string
  /** grazing_owners row with is_self = true. */
  selfOwnerId?: string | null
  /** Owner per animal, for animal_specific rows whose animal may not be assigned. */
  animalOwners?: Map<string, string | null>
}

export interface AllocationResult {
  allocations: Allocation[]
  /**
   * Expenses that produced no allocation at all — a shared expense with zero
   * animal-days in its window, or an animal_specific row with no animal. Their
   * money is in no one's column, which is worth surfacing rather than swallowing.
   */
  unallocated: Array<{ expense_id: string; amount: number; reason: string }>
}

export function resolveExpenseKind(e: AllocatableExpense): ExpenseKind {
  const raw = e.category_expense_type || e.expense_type || 'shared'
  if (raw === 'owner_specific' || raw === 'animal_specific') return raw
  return 'shared'
}

/**
 * Calves still on their dam bill with her, so they must not add animal-days of
 * their own — otherwise an owner running pairs pays twice for one unit. A calf
 * only counts as a pair calf when its dam is in THIS assignment set; a calf
 * whose dam left the lease stands on its own.
 */
function findPairCalfIds(assignments: AllocationAssignment[]): Set<string> {
  const assignedIds = new Set(assignments.map(a => a.animal_id))
  const pairCalfIds = new Set<string>()
  for (const a of assignments) {
    if (
      a.sex?.toLowerCase() === 'calf' &&
      !a.weaning_date &&
      a.dam_id &&
      assignedIds.has(a.dam_id)
    ) {
      pairCalfIds.add(a.animal_id)
    }
  }
  return pairCalfIds
}

/**
 * Animal-days per owner over a window — the denominator behind every shared
 * split, and the "% of the herd" figure shown on an invoice. Pair calves are
 * excluded unless asked for, exactly as in the split itself.
 */
export function computeHerdDays(input: {
  assignments: AllocationAssignment[]
  windowStart: string
  windowEnd: string
  includeCalves?: boolean
  selfOwnerId?: string | null
}): { byOwner: Map<OwnerKey, number>; total: number } {
  const { assignments, windowStart, windowEnd } = input
  const selfOwnerId  = input.selfOwnerId ?? null
  const pairCalfIds  = findPairCalfIds(assignments)
  const byOwner      = new Map<OwnerKey, number>()
  let total = 0

  for (const a of assignments) {
    if (!input.includeCalves && pairCalfIds.has(a.animal_id)) continue
    const days = calcOverlapDays(a.start_date, a.end_date, windowStart, windowEnd)
    if (days <= 0) continue
    const key = a.owner_id ?? selfOwnerId ?? null
    byOwner.set(key, (byOwner.get(key) ?? 0) + days)
    total += days
  }

  return { byOwner, total }
}

/**
 * Divide `amount` across weights so the parts sum to the whole, exactly.
 *
 * Rounding each owner's share on its own leaves the invoice off by a cent or
 * two against the expense it came from, and those cents are unattributable
 * later. Largest-remainder in whole cents: floor everyone, then hand the
 * leftover pennies out one each, largest fraction first. Ties break on the
 * owner key so the same inputs always produce the same output — a share that
 * moved a cent between two runs would look like an edit.
 */
function splitCents(amount: number, weights: Array<{ key: OwnerKey; weight: number }>): Map<OwnerKey, number> {
  const out = new Map<OwnerKey, number>()
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0)
  if (totalWeight <= 0 || weights.length === 0) return out

  const sign       = amount < 0 ? -1 : 1
  const totalCents = Math.round(Math.abs(amount) * 100)

  const parts = weights.map(w => {
    const exact = (totalCents * w.weight) / totalWeight
    const floor = Math.floor(exact)
    return { key: w.key, floor, frac: exact - floor }
  })

  let remainder = totalCents - parts.reduce((s, p) => s + p.floor, 0)

  const order = [...parts].sort((a, b) =>
    b.frac - a.frac || String(a.key ?? '').localeCompare(String(b.key ?? ''))
  )
  for (const p of order) {
    if (remainder <= 0) break
    p.floor += 1
    remainder -= 1
  }

  for (const p of parts) out.set(p.key, (sign * p.floor) / 100)
  return out
}

function fmtMoney(n: number): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * The window an expense is split over. A one-time cost lands on its date; a
 * period cost spans its own period. Only when the row says neither does the
 * quarter stand in.
 */
export function expenseWindow(
  e: AllocatableExpense,
  windowStart: string,
  windowEnd: string,
): { start: string; end: string } {
  if (e.calculation_type === 'one_time') {
    const d = e.expense_date
    return { start: d || windowStart, end: d || windowEnd }
  }
  return {
    start: e.period_start || windowStart,
    end:   e.period_end   || windowEnd,
  }
}

export function computeExpenseAllocations(input: AllocationInput): AllocationResult {
  const { expenses, assignments, windowStart, windowEnd } = input
  const selfOwnerId  = input.selfOwnerId ?? null
  const animalOwners = input.animalOwners ?? new Map<string, string | null>()

  // Ranch-owned animals and the ranch's own grazing_owners row are the same
  // pocket. Normalizing here rather than at write time keeps them one column
  // instead of two half-columns that never add up on screen.
  const ownerKeyOf = (ownerId: string | null): OwnerKey => ownerId ?? selfOwnerId ?? null

  const pairCalfIds = findPairCalfIds(assignments)

  const allocations: Allocation[] = []
  const unallocated: AllocationResult['unallocated'] = []

  for (const expense of expenses) {
    const kind   = resolveExpenseKind(expense)
    const amount = Number(expense.total_amount) || 0

    if (kind === 'owner_specific') {
      allocations.push({
        expense_id: expense.id,
        owner_id:   ownerKeyOf(expense.owner_id ?? null),
        amount,
        share_note: null,
        kind,
        days: 0,
        total_days: 0,
      })
      continue
    }

    if (kind === 'animal_specific') {
      if (!expense.animal_id) {
        unallocated.push({ expense_id: expense.id, amount, reason: 'animal_specific row has no animal_id' })
        continue
      }
      // The row's own owner_id is authoritative — it was stamped from the
      // animal at save time, and the animal may have changed hands since.
      const owner = expense.owner_id ?? animalOwners.get(expense.animal_id) ?? null
      allocations.push({
        expense_id: expense.id,
        owner_id:   ownerKeyOf(owner),
        amount,
        share_note: null,
        kind,
        days: 0,
        total_days: 0,
      })
      continue
    }

    // ── Shared: split by animal-days over the expense's own window ───────────
    const includeCalves = expense.include_calves ?? false
    const win = expenseWindow(expense, windowStart, windowEnd)

    const daysByOwner = new Map<OwnerKey, number>()
    let totalDays = 0

    for (const a of assignments) {
      if (!includeCalves && pairCalfIds.has(a.animal_id)) continue
      const days = calcOverlapDays(a.start_date, a.end_date, win.start, win.end)
      if (days <= 0) continue
      const key = ownerKeyOf(a.owner_id)
      daysByOwner.set(key, (daysByOwner.get(key) ?? 0) + days)
      totalDays += days
    }

    if (totalDays <= 0) {
      unallocated.push({
        expense_id: expense.id,
        amount,
        reason: `no animal-days between ${win.start} and ${win.end}`,
      })
      continue
    }

    const weights = [...daysByOwner.entries()].map(([key, days]) => ({ key, weight: days }))
    const shares  = splitCents(amount, weights)

    for (const [key, days] of daysByOwner) {
      const share = shares.get(key) ?? 0
      if (share === 0) continue
      const pct = ((days / totalDays) * 100).toFixed(1)
      allocations.push({
        expense_id: expense.id,
        owner_id:   key,
        amount:     share,
        share_note: `${pct}% of $${fmtMoney(amount)}`,
        kind,
        days,
        total_days: totalDays,
      })
    }
  }

  return { allocations, unallocated }
}

/** Convenience: the allocations belonging to one owner. */
export function allocationsForOwner(allocations: Allocation[], ownerId: string): Allocation[] {
  return allocations.filter(a => a.owner_id === ownerId)
}
