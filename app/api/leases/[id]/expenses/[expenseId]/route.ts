export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string; expenseId: string }> }

const ALLOWED = [
  'category_name', 'category_id', 'expense_type', 'description', 'total_amount',
  'expense_date', 'receipt_url', 'period_start', 'period_end',
  'owner_id', 'animal_id', 'year', 'quarter', 'notes',
  'qty', 'unit_cost', 'sire_library_id', 'bull_name', 'include_calves',
]

export async function PATCH(req: NextRequest, { params }: Params) {
  const { expenseId } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (k in body) updates[k] = body[k]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lease_expenses')
    .delete()
    .eq('id', expenseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
