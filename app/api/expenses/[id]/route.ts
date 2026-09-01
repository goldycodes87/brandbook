export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Update } from '@/lib/supabase/admin'
import {
  loadSplitGroupFor,
  rewriteSplitGroup,
  deleteSplitGroup,
  type SplitEditInput,
} from '@/lib/expense-split-group'

type Params = { params: Promise<{ id: string }> }

const ALLOWED = [
  'category_name', 'category_id', 'expense_type', 'description', 'total_amount',
  'expense_date', 'receipt_url', 'period_start', 'period_end',
  'owner_id', 'animal_id', 'year', 'quarter', 'notes',
  'qty', 'unit_cost', 'sire_library_id', 'bull_name', 'include_calves',
  'is_lease_specific',
]

// GET /api/expenses/[id]
//
// Returns the row, plus its split when it has one. An edit form that prefills
// from the row alone sees a single animal and a single animal's share, and
// saving it silently shrinks a twelve-head split to one.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id }   = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('lease_expenses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  const group = await loadSplitGroupFor(supabase, id)

  return NextResponse.json({
    data,
    split: group && {
      split_group_id: group.groupId,
      animal_ids:     group.animalIds,
      total_amount:   Math.round(group.total * 100) / 100,
      row_count:      group.rows.length,
      invoiced:       group.invoiced,
    },
  })
}

/** Map an incoming PATCH body onto the split-edit shape. */
function splitEditFrom(body: Record<string, unknown>): SplitEditInput {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
  const input: SplitEditInput = {}

  if (Array.isArray(body.animal_ids)) input.animalIds = body.animal_ids as string[]
  // total_amount on a split means the WHOLE expense, not one animal's share.
  if (has('total_amount') && body.total_amount != null) input.totalAmount = Number(body.total_amount)
  if (has('per_head_amount')) input.perHeadAmount = body.per_head_amount != null ? Number(body.per_head_amount) : null
  if (has('category_name')) input.categoryName = String(body.category_name)
  if (has('category_id'))   input.categoryId   = (body.category_id as string | null) ?? null
  if (has('description'))   input.description  = (body.description as string | null) ?? null
  if (has('expense_date'))  input.expenseDate  = (body.expense_date as string | null) ?? null
  if (has('notes'))         input.notes        = (body.notes as string | null) ?? null

  return input
}

// PATCH /api/expenses/[id]
//
// A row that belongs to a split is edited as a split: the total is re-divided
// across its animals and every row is replaced. Editing one row of a split
// used to write the full total onto that row and leave the others alone, so a
// $2,100 split across 12 head edited to $2,400 became $4,325.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id }    = await params
  const body      = await req.json()
  const supabase  = createAdminClient()

  const group = await loadSplitGroupFor(supabase, id)

  if (group) {
    const result = await rewriteSplitGroup(supabase, group, splitEditFrom(body))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({
      data:           result.rows,
      split_group_id: group.groupId,
      rows_replaced:  result.count,
    })
  }

  const updates: Update<'lease_expenses'> = {}
  for (const k of ALLOWED) {
    if (k in body) (updates as Record<string, unknown>)[k] = body[k]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields in request body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lease_expenses')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/expenses/[id] — removes the whole split when the row is part of
// one. Deleting a single member would leave the remaining rows summing to less
// than the expense they came from.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id }   = await params
  const supabase = createAdminClient()

  const group = await loadSplitGroupFor(supabase, id)

  if (group) {
    const result = await deleteSplitGroup(supabase, group)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, rows_deleted: result.count })
  }

  const { error } = await supabase
    .from('lease_expenses')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows_deleted: 1 })
}
