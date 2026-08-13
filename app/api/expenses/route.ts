export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildExpenseRow, missingRequired, type ExpenseBody } from '@/lib/expense-row'

// GET /api/expenses — whole-herd (is_lease_specific=false) expenses
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const sp       = req.nextUrl.searchParams
  const year     = sp.get('year')
  const quarter  = sp.get('quarter')

  let query = supabase
    .from('lease_expenses')
    .select('*')
    .eq('is_lease_specific', false)
    .order('expense_date', { ascending: false })

  if (year)    query = query.eq('year',    Number(year))
  if (quarter) query = query.eq('quarter', Number(quarter))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/expenses — create whole-herd expense (lease_id = null)
//
// Two shapes:
//   { ...expense }        -> inserts one row, responds { data: <row> }
//   { rows: [ ...., ] }   -> inserts every row in a SINGLE statement, so a
//                            multi-animal split either lands completely or
//                            not at all. Responds { data: <row[]> }.
export async function POST(req: NextRequest) {
  const body     = await req.json()
  const supabase = createAdminClient()

  const batch: ExpenseBody[] | null = Array.isArray(body?.rows) ? body.rows : null

  if (batch) {
    if (batch.length === 0) {
      return NextResponse.json({ error: 'rows must not be empty' }, { status: 400 })
    }
    if (batch.some(missingRequired)) {
      return NextResponse.json({ error: 'every row requires category_name and total_amount' }, { status: 400 })
    }

    // One id across the batch. Without it the rows are indistinguishable from
    // N unrelated per-animal expenses, and editing the split can only ever
    // reach whichever row happened to be clicked.
    const splitGroupId = body.split_group_id ?? randomUUID()

    const { data, error } = await supabase
      .from('lease_expenses')
      .insert(batch.map(row => ({ ...buildExpenseRow(row), split_group_id: splitGroupId })))
      .select('*')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, split_group_id: splitGroupId }, { status: 201 })
  }

  if (missingRequired(body)) {
    return NextResponse.json({ error: 'category_name and total_amount are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lease_expenses')
    .insert(buildExpenseRow(body))
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
