export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { asInvoiceStatus } from '@/lib/db-enums'

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const owner_id = sp.get('owner_id')
  const status   = sp.get('status')
  const date_from = sp.get('date_from')
  const date_to   = sp.get('date_to')
  const limit  = Math.min(Number(sp.get('limit') ?? 50), 200)
  const offset = Number(sp.get('offset') ?? 0)

  const supabase = createAdminClient()

  let query = supabase
    .from('invoices')
    .select('*, owner:grazing_owners(id, name, company_name, owner_name, email, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (owner_id)                      query = query.eq('owner_id', owner_id)
  const invoiceStatus = status && status !== 'all' ? asInvoiceStatus(status) : null
  if (invoiceStatus) query = query.eq('status', invoiceStatus)
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

  const splits = expense_splits as Array<{
    owner_amount: number
    /** lease_expenses.id when this split came from a real expense row. */
    expense_id?: string | null
    description?: string | null
    category_name?: string | null
  }>

  const lineTotal    = (line_items as Array<{ amount: number }>).reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const expenseTotal = splits.reduce((s, e) => s + (Number(e.owner_amount) || 0), 0)
  const total_amount = lineTotal + expenseTotal

  // Splits that came from a real lease_expenses row have to be recorded as
  // allocations, or the quarterly run bills the same money again in October.
  // Free-form lines — hauling, a repair — carry no expense_id and need none.
  const allocations = splits
    .filter(e => e.expense_id)
    .map(e => ({
      expense_id: e.expense_id as string,
      owner_id,
      amount:     Number(e.owner_amount) || 0,
      share_note: e.description ?? e.category_name ?? null,
    }))

  const { data, error } = await supabase.rpc('create_manual_invoice', {
    p_owner_id:       owner_id,
    p_line_items:     line_items,
    p_total:          total_amount,
    p_expense_splits: splits,
    ...(period_start ? { p_period_start: period_start } : {}),
    ...(period_end   ? { p_period_end:   period_end   } : {}),
    ...(due_date     ? { p_due_date:     due_date     } : {}),
    ...(notes        ? { p_notes:        notes        } : {}),
    ...(allocations.length > 0
      ? {
          p_allocations:        allocations,
          p_billed_expense_ids: allocations.map(a => a.expense_id),
        }
      : {}),
  })

  if (error) {
    // The guard fired: one of these expenses is already on a live invoice.
    if (error.code === '23505') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
