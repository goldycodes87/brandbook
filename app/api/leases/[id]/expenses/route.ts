export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lease_expenses')
    .select('*')
    .eq('lease_id', id)
    .order('expense_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body   = await req.json()
  const supabase = createAdminClient()

  const { category_name, description, total_amount, expense_date, receipt_url, period_start, period_end } = body

  if (!category_name || total_amount === undefined || total_amount === null) {
    return NextResponse.json({ error: 'category_name and total_amount are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lease_expenses')
    .insert({
      lease_id:      id,
      category_name,
      description:   description   || null,
      total_amount:  Number(total_amount),
      expense_date:  expense_date  || null,
      receipt_url:   receipt_url   || null,
      period_start:  period_start  || null,
      period_end:    period_end    || null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
