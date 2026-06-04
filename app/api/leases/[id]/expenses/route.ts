export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const year         = sp.get('year')
  const quarter      = sp.get('quarter')
  const expense_type = sp.get('expense_type')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('lease_expenses')
    .select('*')
    .eq('lease_id', id)
    .order('expense_date', { ascending: false })

  if (year)         query = query.eq('year', Number(year))
  if (quarter)      query = query.eq('quarter', Number(quarter))
  if (expense_type) query = query.eq('expense_type', expense_type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id }    = await params
  const body      = await req.json()
  const supabase  = createAdminClient()

  const {
    category_name, category_id, description, total_amount, expense_date,
    receipt_url, period_start, period_end, expense_type,
    owner_id, animal_id, notes, quantity, unit_cost,
    sire_library_id, bull_name,
  } = body

  if (!category_name || total_amount === undefined || total_amount === null) {
    return NextResponse.json({ error: 'category_name and total_amount are required' }, { status: 400 })
  }

  // Auto-derive year + quarter from expense_date
  let year: number | null = null
  let quarter: number | null = null
  if (expense_date) {
    const d = new Date(expense_date)
    year    = d.getFullYear() % 100
    quarter = Math.ceil((d.getMonth() + 1) / 3)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lease_expenses')
    .insert({
      lease_id:        id,
      category_name:   category_name,
      category_id:     category_id     || null,
      expense_type:    expense_type    || 'shared',
      description:     description     || null,
      total_amount:    Number(total_amount),
      expense_date:    expense_date    || null,
      receipt_url:     receipt_url     || null,
      period_start:    period_start    || null,
      period_end:      period_end      || null,
      owner_id:        owner_id        || null,
      animal_id:       animal_id       || null,
      year,
      quarter,
      notes:           notes           || null,
      quantity:        quantity        != null ? Number(quantity)  : null,
      unit_cost:       unit_cost       != null ? Number(unit_cost) : null,
      sire_library_id: sire_library_id || null,
      bull_name:       bull_name       || null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
