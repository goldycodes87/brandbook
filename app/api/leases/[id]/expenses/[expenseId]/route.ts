export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadSplitGroupFor, rewriteSplitGroup, deleteSplitGroup } from '@/lib/expense-split-group'

type Params = { params: Promise<{ id: string; expenseId: string }> }

const ALLOWED = [
  'category_name', 'category_id', 'expense_type', 'description', 'total_amount',
  'expense_date', 'receipt_url', 'period_start', 'period_end',
  'owner_id', 'animal_id', 'year', 'quarter', 'notes',
  'qty', 'unit_cost', 'sire_library_id', 'bull_name', 'include_calves',
  'is_lease_specific',
]

// A split reached through the lease route is still a split. Both routes go
// through lib/expense-split-group so an expense cannot be safe to edit from
// one screen and corrupting from another.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { expenseId } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const group = await loadSplitGroupFor(supabase, expenseId)

  if (group) {
    const result = await rewriteSplitGroup(supabase, group, {
      ...(Array.isArray(body.animal_ids) ? { animalIds: body.animal_ids as string[] } : {}),
      ...(body.total_amount != null ? { totalAmount: Number(body.total_amount) } : {}),
      ...('category_name' in body ? { categoryName: String(body.category_name) } : {}),
      ...('category_id'   in body ? { categoryId:   body.category_id ?? null } : {}),
      ...('description'   in body ? { description:  body.description ?? null } : {}),
      ...('expense_date'  in body ? { expenseDate:  body.expense_date ?? null } : {}),
      ...('notes'         in body ? { notes:        body.notes ?? null } : {}),
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ data: result.rows, split_group_id: group.groupId, rows_replaced: result.count })
  }

  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (k in body) updates[k] = body[k]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields in request body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lease_expenses')
    .update(updates)
    .eq('id', expenseId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { expenseId } = await params
  const supabase = createAdminClient()

  const group = await loadSplitGroupFor(supabase, expenseId)

  if (group) {
    const result = await deleteSplitGroup(supabase, group)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, rows_deleted: result.count })
  }

  const { error } = await supabase
    .from('lease_expenses')
    .delete()
    .eq('id', expenseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows_deleted: 1 })
}
