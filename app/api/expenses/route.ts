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

// POST /api/expenses — create whole-herd expense (lease_id = null)
export async function POST(req: NextRequest) {
  const body     = await req.json()
  const supabase = createAdminClient()

  const {
    category_name, category_id, description, total_amount, expense_date,
    receipt_url, period_start, period_end, expense_type,
    owner_id, animal_id, notes, qty, unit_cost,
    sire_library_id, bull_name, include_calves,
    quarter, year, reproduction_event_id,
  } = body

  if (!category_name || total_amount === undefined || total_amount === null) {
    return NextResponse.json({ error: 'category_name and total_amount are required' }, { status: 400 })
  }

  // Use explicit quarter/year if provided; otherwise derive from expense_date
  let resolvedYear: number | null = year != null ? Number(year) : null
  let resolvedQuarter: number | null = quarter != null ? Number(quarter) : null
  if ((resolvedYear === null || resolvedQuarter === null) && expense_date) {
    const d = new Date(expense_date)
    if (resolvedYear    === null) resolvedYear    = d.getFullYear() % 100
    if (resolvedQuarter === null) resolvedQuarter = Math.ceil((d.getMonth() + 1) / 3)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lease_expenses')
    .insert({
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
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
