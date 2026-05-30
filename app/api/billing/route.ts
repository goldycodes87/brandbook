export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const owner_id = sp.get('owner_id')
  const status   = sp.get('status')
  const date_from = sp.get('date_from')
  const date_to   = sp.get('date_to')
  const limit  = Math.min(Number(sp.get('limit') ?? 50), 200)
  const offset = Number(sp.get('offset') ?? 0)

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('invoices')
    .select('*, owner:grazing_owners(id, name, company_name, owner_name, email, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (owner_id)                      query = query.eq('owner_id', owner_id)
  if (status && status !== 'all')    query = query.eq('status', status)
  if (date_from)                     query = query.gte('period_start', date_from)
  if (date_to)                       query = query.lte('period_end', date_to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], count })
}

export async function POST(req: NextRequest) {
  const body     = await req.json()
  const supabase = createAdminClient()

  const { owner_id, period_start, period_end, due_date, notes, line_items = [], expense_splits = [] } = body
  if (!owner_id) return NextResponse.json({ error: 'owner_id required' }, { status: 400 })

  const lineTotal    = (line_items    as Array<{ amount: number }>).reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const expenseTotal = (expense_splits as Array<{ owner_amount: number }>).reduce((s, e) => s + (Number(e.owner_amount) || 0), 0)
  const total_amount = lineTotal + expenseTotal

  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const rand  = String(Math.floor(1000 + Math.random() * 9000))
  const invoice_number = `INV-${year}${month}-${rand}`

  const row = {
    owner_id,
    invoice_number,
    period_start:   period_start  || null,
    period_end:     period_end    || null,
    due_date:       due_date      || null,
    notes:          notes         || null,
    line_items,
    expense_splits,
    total_amount,
    status: 'draft',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invoices')
    .insert(row)
    .select('*, owner:grazing_owners(id, name, company_name, owner_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
