export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('*, owner:grazing_owners(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body     = await req.json()
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = {}
  const allowed = ['status', 'notes', 'due_date', 'period_start', 'period_end',
                   'line_items', 'expense_splits', 'paid_at', 'pdf_url', 'viewed_at']
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }

  if ('line_items' in updates || 'expense_splits' in updates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cur } = await (supabase as any)
      .from('invoices').select('line_items, expense_splits').eq('id', id).single()
    const li = (('line_items' in updates ? updates.line_items : cur?.line_items) as Array<{ amount: number }>) ?? []
    const es = (('expense_splits' in updates ? updates.expense_splits : cur?.expense_splits) as Array<{ owner_amount: number }>) ?? []
    updates.total_amount =
      li.reduce((s, i) => s + (Number(i.amount) || 0), 0) +
      es.reduce((s, e) => s + (Number(e.owner_amount) || 0), 0)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invoices').update(updates).eq('id', id)
    .select('*, owner:grazing_owners(id, name, company_name, owner_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv } = await (supabase as any)
    .from('invoices').select('status').eq('id', id).single()
  if (inv?.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
