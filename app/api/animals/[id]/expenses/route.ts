export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

type ExpenseRow = {
  id: string
  category_name: string | null
  description: string | null
  total_amount: number | null
  expense_date: string | null
  expense_type: string | null
  owner_id: string | null
  animal_id: string | null
  invoice_id: string | null
}

type InvoiceRow = {
  id: string
  invoice_number: string | null
  status: string | null
}

/** pending -> not on an invoice | invoiced -> on an unpaid invoice | paid */
function statusFor(expense: ExpenseRow, invoices: Map<string, InvoiceRow>) {
  if (!expense.invoice_id) return { status: 'pending' as const, invoice: null }
  const inv = invoices.get(expense.invoice_id) ?? null
  if (!inv) return { status: 'pending' as const, invoice: null }
  return {
    status: inv.status === 'paid' ? ('paid' as const) : ('invoiced' as const),
    invoice: { id: inv.id, invoice_number: inv.invoice_number, status: inv.status },
  }
}

// GET /api/animals/[id]/expenses?year=2026
//
// Direct costs only — expenses carrying this animal_id, which covers both
// single-animal entries and each animal's share of a multi-animal split.
// Owner-level and whole-herd expenses are deliberately NOT pro-rated onto the
// animal here: they are billed at owner/herd level, and attributing them per
// head would double-count against lease billing.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const yearParam = req.nextUrl.searchParams.get('year')
  const year      = yearParam ? Number(yearParam) : new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const { data: rawDirect, error } = await supabase
    .from('lease_expenses')
    .select('id, category_name, description, total_amount, expense_date, expense_type, owner_id, animal_id, invoice_id')
    .eq('animal_id', id)
    .order('expense_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const direct = (rawDirect ?? []) as unknown as ExpenseRow[]

  // Resolve the invoices these expenses landed on, for status badges.
  const invoiceIds = [...new Set(direct.map(e => e.invoice_id).filter(Boolean))] as string[]
  const invoices = new Map<string, InvoiceRow>()
  if (invoiceIds.length > 0) {
    const { data: invRows } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .in('id', invoiceIds)
    for (const inv of (invRows ?? []) as unknown as InvoiceRow[]) invoices.set(inv.id, inv)
  }

  const inYear = (d: string | null) => !!d && d >= yearStart && d <= yearEnd

  const direct_expenses = direct.map(e => {
    const { status, invoice } = statusFor(e, invoices)
    return {
      id:            e.id,
      category_name: e.category_name,
      description:   e.description,
      amount:        Number(e.total_amount ?? 0),
      expense_date:  e.expense_date,
      expense_type:  e.expense_type,
      status,
      invoice,
      in_year:       inYear(e.expense_date),
    }
  })

  const ytd = direct_expenses.filter(e => e.in_year)
  const sum = (rows: typeof ytd) => Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100

  return NextResponse.json({
    year,
    direct_expenses,
    total_ytd:    sum(ytd),
    invoiced_ytd: sum(ytd.filter(e => e.status === 'invoiced')),
    paid_ytd:     sum(ytd.filter(e => e.status === 'paid')),
    pending_ytd:  sum(ytd.filter(e => e.status === 'pending')),
    note: 'Owner-level and whole-herd expenses are billed at owner/herd level and are not pro-rated here — see lease billing for the full breakdown.',
  })
}
