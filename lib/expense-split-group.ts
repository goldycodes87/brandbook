// Reading and rewriting a multi-animal split as one expense.
//
// A split is N lease_expenses rows sharing a split_group_id. Editing it means
// re-dividing the total across a possibly different set of animals, so the
// rows are replaced rather than patched -- patching one row is exactly the bug
// this exists to fix.
//
// The per-head arithmetic is NOT reimplemented here: it comes from
// buildAnimalSplitRows in lib/expense-split.ts, the same function that creates
// a split. An edit that divided the money differently from a create is the
// drift this codebase keeps paying for.

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildAnimalSplitRows } from '@/lib/expense-split'
import { buildExpenseRow, type ExpenseBody } from '@/lib/expense-row'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, 'public', any>

export interface SplitGroupRow {
  id: string
  split_group_id: string | null
  animal_id: string | null
  owner_id: string | null
  total_amount: number
  invoice_id: string | null
  category_name: string | null
  category_id: string | null
  description: string | null
  expense_date: string | null
  notes: string | null
  expense_type: string | null
}

export interface SplitGroup {
  groupId: string
  rows: SplitGroupRow[]
  animalIds: string[]
  /** The whole expense: every member's share added back up. */
  total: number
  invoiced: boolean
}

const GROUP_SELECT =
  'id, split_group_id, animal_id, owner_id, total_amount, invoice_id, ' +
  'category_name, category_id, description, expense_date, notes, expense_type'

/**
 * The split an expense row belongs to, or null when the row stands alone.
 * Callers treat null as "ordinary single-row expense" and carry on.
 */
export async function loadSplitGroupFor(
  supabase: DB,
  expenseId: string,
): Promise<SplitGroup | null> {
  const { data: row } = await supabase
    .from('lease_expenses')
    .select('split_group_id')
    .eq('id', expenseId)
    .maybeSingle()

  const groupId = (row as { split_group_id: string | null } | null)?.split_group_id
  if (!groupId) return null

  const { data } = await supabase
    .from('lease_expenses')
    .select(GROUP_SELECT)
    .eq('split_group_id', groupId)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as unknown as SplitGroupRow[]
  if (rows.length === 0) return null

  return {
    groupId,
    rows,
    animalIds: rows.map(r => r.animal_id).filter((x): x is string => !!x),
    total:     rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
    invoiced:  rows.some(r => r.invoice_id != null),
  }
}

export interface SplitEditInput {
  /** New membership. Omit to keep the animals the split already covers. */
  animalIds?: string[]
  /** New GROUP total — the whole expense, not one animal's share. */
  totalAmount?: number
  /** Fixed rate per animal (AI fee, semen straw); wins over totalAmount. */
  perHeadAmount?: number | null
  categoryName?: string
  categoryId?: string | null
  description?: string | null
  expenseDate?: string | null
  notes?: string | null
}

export type SplitEditResult =
  | { ok: true; rows: unknown[]; count: number }
  | { ok: false; status: number; error: string }

/**
 * Re-divide a split and replace its rows.
 *
 * Owners are resolved from the animals table rather than trusted from the
 * client: a share must land on whoever owns the animal now, and the caller
 * editing an amount has no business reassigning who pays.
 */
export async function rewriteSplitGroup(
  supabase: DB,
  group: SplitGroup,
  input: SplitEditInput,
): Promise<SplitEditResult> {
  if (group.invoiced) {
    return {
      ok: false,
      status: 409,
      error: 'This expense has already been invoiced. Void or credit the invoice instead of editing the split.',
    }
  }

  const animalIds = input.animalIds && input.animalIds.length > 0
    ? input.animalIds
    : group.animalIds

  if (animalIds.length === 0) {
    return { ok: false, status: 400, error: 'A split needs at least one animal' }
  }

  const { data: animalRows } = await supabase
    .from('animals')
    .select('id, owner_id')
    .in('id', animalIds)

  const animals = (animalRows ?? []) as unknown as Array<{ id: string; owner_id: string | null }>

  const missing = animalIds.filter(id => !animals.some(a => a.id === id))
  if (missing.length > 0) {
    return { ok: false, status: 400, error: `Unknown animal(s): ${missing.join(', ')}` }
  }

  const { data: selfOwner } = await supabase
    .from('grazing_owners')
    .select('id')
    .eq('is_self', true)
    .maybeSingle()

  const head = group.rows[0]

  const rows = buildAnimalSplitRows({
    animalIds,
    animals,
    selfOwnerId:   (selfOwner as { id: string } | null)?.id ?? null,
    totalAmount:   input.totalAmount ?? group.total,
    perHeadAmount: input.perHeadAmount ?? null,
    categoryName:  input.categoryName ?? head.category_name ?? '',
    categoryId:    input.categoryId   !== undefined ? input.categoryId   : head.category_id,
    description:   input.description  !== undefined ? input.description  : head.description,
    expenseDate:   input.expenseDate  !== undefined ? input.expenseDate  : head.expense_date,
    notes:         input.notes        !== undefined ? input.notes        : head.notes,
  })

  // Shaped through the same builder as a create so quarter/year and every
  // other derived column match what the original rows carried.
  const payload = rows.map(r => buildExpenseRow(r as unknown as ExpenseBody))

  const { data, error } = await supabase.rpc('replace_expense_split', {
    p_group_id: group.groupId,
    p_rows:     payload,
  })

  if (error) {
    // The RPC raises check_violation when the split is already invoiced --
    // a race against an invoice generated between the load and the write.
    const invoiced = /already been invoiced/i.test(error.message)
    return { ok: false, status: invoiced ? 409 : 500, error: error.message }
  }

  const saved = (data ?? []) as unknown[]
  return { ok: true, rows: saved, count: saved.length }
}

/** Delete every row of a split. Refuses once any part of it has been billed. */
export async function deleteSplitGroup(
  supabase: DB,
  group: SplitGroup,
): Promise<SplitEditResult> {
  if (group.invoiced) {
    return {
      ok: false,
      status: 409,
      error: 'This expense has already been invoiced and cannot be deleted.',
    }
  }

  const { error } = await supabase
    .from('lease_expenses')
    .delete()
    .eq('split_group_id', group.groupId)

  if (error) return { ok: false, status: 500, error: error.message }
  return { ok: true, rows: [], count: group.rows.length }
}
