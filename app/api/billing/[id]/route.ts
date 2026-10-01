export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Update } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  // This used to refuse the request whenever a brandbook_owner_session cookie
  // was present in the browser, which is not the same question as "is an owner
  // asking". Cookies are per browser, not per tab: an operator who had opened
  // an owner portal once -- which is exactly what you do when checking what an
  // owner sees -- carried that cookie forever after and got 403 on every
  // invoice, surfacing as "Invoice not found".
  //
  // The proxy already gates /api/billing/* on a validly signed
  // brandbook_session and nothing else, so an owner holding only a portal
  // cookie is turned away before reaching this line. The check added no
  // protection and cost the operator the page.
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
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

  const updates: Update<'invoices'> = {}
  const allowed = [
    'status', 'notes', 'due_date', 'period_start', 'period_end',
    'line_items', 'expense_splits', 'paid_at', 'pdf_url', 'viewed_at',
    'approved_at', 'sent_at', 'email_sent_at',
    'paid_amount', 'payment_method', 'payment_reference',
  ]
  for (const k of allowed) {
    if (k in body) (updates as Record<string, unknown>)[k] = body[k]
  }

  // Auto-set timestamps on status transitions
  const now = new Date().toISOString()
  if (body.status === 'approved' && !('approved_at' in body)) updates.approved_at = now
  if (body.status === 'sent'     && !('sent_at'     in body)) { updates.sent_at = now; updates.email_sent_at = now }
  if (body.status === 'paid'     && !('paid_at'     in body)) updates.paid_at = now

  if ('line_items' in updates || 'expense_splits' in updates) {
    const { data: cur } = await supabase
      .from('invoices').select('line_items, expense_splits').eq('id', id).single()
    const li = (('line_items' in updates ? updates.line_items : cur?.line_items) as Array<{ amount: number }>) ?? []
    const es = (('expense_splits' in updates ? updates.expense_splits : cur?.expense_splits) as Array<{ owner_amount: number }>) ?? []
    updates.total_amount =
      li.reduce((s, i) => s + (Number(i.amount) || 0), 0) +
      es.reduce((s, e) => s + (Number(e.owner_amount) || 0), 0)
  }

  const { data, error } = await supabase
    .from('invoices').update(updates).eq('id', id)
    .select('*, owner:grazing_owners(id, name, company_name, owner_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/**
 * Delete an invoice, and give back what it was holding.
 *
 * Only a draft or a void. A sent, approved or paid invoice is a record of
 * money that has been put in front of somebody, and the way to retract one is
 * to void it — which leaves the number, the figures and the reason on the
 * books. Deleting it would leave a hole in the sequence that nobody can
 * explain a year later.
 *
 * The expenses it covered have to be released, or they stay stamped as billed
 * on a row that no longer exists and can never be charged to anybody again.
 * That was the live bug in the old version: it deleted the invoice and left
 * lease_expenses.invoice_id and the allocations pointing at nothing.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: inv } = await supabase
    .from('invoices').select('status, invoice_number').eq('id', id).single()

  const status = (inv as { status: string | null } | null)?.status ?? null
  if (status !== 'draft' && status !== 'void') {
    return NextResponse.json(
      {
        error: status
          ? `That invoice is ${status}. Void it first — a sent or paid invoice stays on the books.`
          : 'Invoice not found',
      },
      { status: 400 },
    )
  }

  const { error: unstamp } = await supabase
    .from('lease_expenses').update({ invoice_id: null }).eq('invoice_id', id)
  if (unstamp) return NextResponse.json({ error: unstamp.message }, { status: 500 })

  const { error: unalloc } = await supabase
    .from('expense_allocations').delete().eq('invoice_id', id)
  if (unalloc) return NextResponse.json({ error: unalloc.message }, { status: 500 })

  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    deleted: (inv as { invoice_number: string | null } | null)?.invoice_number ?? null,
  })
}
