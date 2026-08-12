export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/expenses — whole-herd (is_lease_specific=false) expenses
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const sp       = req.nextUrl.searchParams
  const year     = sp.get('year')
  const quarter  = sp.get('quarter')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
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

type ExpenseBody = Record<string, unknown>

/** Shape one incoming payload into a lease_expenses row. */
function buildExpenseRow(body: ExpenseBody) {
  const {
    category_name, category_id, description, total_amount, expense_date,
    receipt_url, period_start, period_end, expense_type,
    owner_id, animal_id, notes, qty, unit_cost,
    sire_library_id, bull_name, include_calves,
    quarter, year, reproduction_event_id,
  } = body as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  // Use explicit quarter/year if provided; otherwise derive from expense_date
  let resolvedYear: number | null = year != null ? Number(year) : null
  let resolvedQuarter: number | null = quarter != null ? Number(quarter) : null
  if ((resolvedYear === null || resolvedQuarter === null) && expense_date) {
    const d = new Date(expense_date)
    if (resolvedYear    === null) resolvedYear    = d.getFullYear() % 100
    if (resolvedQuarter === null) resolvedQuarter = Math.ceil((d.getMonth() + 1) / 3)
  }

  return {
    lease_id:         null,
    is_lease_specific: false,
    category_name,
    category_id:      category_id     || null,
    expense_type:     expense_type    || 'shared',
    description:      description     || null,
    total_amount:     Number(total_amount),
    expense_date:     expense_date    || null,
    receipt_url:      receipt_url     || null,
    period_start:     period_start    || null,
    period_end:       period_end      || null,
    owner_id:         owner_id        || null,
    animal_id:        animal_id       || null,
    year:             resolvedYear,
    quarter:          resolvedQuarter,
    notes:            notes           || null,
    qty:              qty             != null ? Number(qty)       : null,
    unit_cost:        unit_cost       != null ? Number(unit_cost) : null,
    sire_library_id:        sire_library_id        || null,
    bull_name:              bull_name              || null,
    include_calves:         Boolean(include_calves),
    reproduction_event_id:  reproduction_event_id  || null,
  }
}

function missingRequired(body: ExpenseBody): boolean {
  const b = body as Record<string, unknown>
  return !b.category_name || b.total_amount === undefined || b.total_amount === null
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('lease_expenses')
      .insert(batch.map(buildExpenseRow))
      .select('*')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  }

  if (missingRequired(body)) {
    return NextResponse.json({ error: 'category_name and total_amount are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lease_expenses')
    .insert(buildExpenseRow(body))
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
