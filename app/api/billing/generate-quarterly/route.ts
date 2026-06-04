export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function quarterRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3  // 0-based
  const endMonth   = startMonth + 2
  const yy = 2000 + year
  const start = new Date(yy, startMonth, 1).toISOString().slice(0, 10)
  const end   = new Date(yy, endMonth + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    owner_id,
    billing_quarter,
    billing_year,
    expense_quarter,
    expense_year,
    due_date,
    dry_run = false,
  }: {
    owner_id: string
    billing_quarter: number
    billing_year: number
    expense_quarter: number
    expense_year: number
    due_date: string
    dry_run?: boolean
  } = body

  if (!owner_id || !billing_quarter || !billing_year) {
    return NextResponse.json({ error: 'owner_id, billing_quarter, billing_year required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Step 1: Fetch owner ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner } = await (supabase as any)
    .from('grazing_owners')
    .select('id, name, company_name, owner_name, email, address, city, state, zip')
    .eq('id', owner_id)
    .single()

  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  // ── Step 2: Fetch active contract for rate ───────────────────────────────────
  const { data: contract } = await supabase
    .from('grazing_contracts')
    .select('rate_per_head_month, expense_share_pct, expense_share_method')
    .eq('owner_id', owner_id)
    .eq('is_active', true)
    .maybeSingle()

  const monthlyRate = contract?.rate_per_head_month ?? 0

  // ── Step 3: Count active owner animals ──────────────────────────────────────
  const { count: headCount } = await supabase
    .from('animals')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', owner_id)
    .eq('status', 'active')

  const ownerHead        = headCount ?? 0
  const quarterlyGrazing = ownerHead * monthlyRate * 3

  // ── Step 4: Billing quarter date range ──────────────────────────────────────
  const { start: bStart, end: bEnd } = quarterRange(billing_year, billing_quarter)
  const bStartLabel = fmtDate(bStart)
  const bEndLabel   = fmtDate(bEnd)

  const lineItems: Array<{ description: string; quantity: number; unit_price: number; amount: number }> = []

  if (ownerHead > 0 && monthlyRate > 0) {
    lineItems.push({
      description: `Grazing Per Head Per Month (Q${billing_quarter} ${2000 + billing_year} — ${bStartLabel} – ${bEndLabel})`,
      quantity:    ownerHead,
      unit_price:  monthlyRate,
      amount:      Math.round(quarterlyGrazing * 100) / 100,
    })
  }

  // ── Step 5: Fetch ALL active animals on all leases for herd % calc ───────────
  // Count total animals on lease(s) during expense quarter to determine owner %
  const { start: eStart, end: eEnd } = quarterRange(expense_year, expense_quarter)

  // Get all animals on any lease the owner participates in
  const { data: ownerAssignments } = await supabase
    .from('grazing_assignments')
    .select('lease_id')
    .eq('owner_id', owner_id)
    .or(`end_date.is.null,end_date.gte.${eStart}`)

  const ownerLeaseIds = [...new Set((ownerAssignments ?? []).map((a: { lease_id: string }) => a.lease_id))]

  // ── Step 6: Fetch expense-quarter lease expenses ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawExpenses } = await (supabase as any)
    .from('lease_expenses')
    .select('id, lease_id, expense_type, category_name, description, total_amount, owner_id, animal_id')
    .in(ownerLeaseIds.length > 0 ? 'lease_id' : 'id', ownerLeaseIds.length > 0 ? ownerLeaseIds : ['__none__'])
    .gte('expense_date', eStart)
    .lte('expense_date', eEnd)

  const expenses = (rawExpenses ?? []) as Array<{
    id: string; lease_id: string; expense_type: string
    category_name: string; description: string | null
    total_amount: number; owner_id: string | null; animal_id: string | null
  }>

  // For shared expenses, calculate owner's % per lease
  const leaseOwnerPcts: Record<string, number> = {}
  for (const leaseId of ownerLeaseIds) {
    const { data: allAssign } = await supabase
      .from('grazing_assignments')
      .select('animal_id, owner_id')
      .eq('lease_id', leaseId)
      .or(`end_date.is.null,end_date.gte.${eStart}`)

    const allAnimals   = (allAssign ?? []) as { animal_id: string; owner_id: string }[]
    const totalOnLease = allAnimals.length
    const ownerOnLease = allAnimals.filter(a => a.owner_id === owner_id).length
    leaseOwnerPcts[leaseId] = totalOnLease > 0 ? ownerOnLease / totalOnLease : 0
  }

  // Group expense line items
  const expenseGroups: Record<string, { description: string; total: number }> = {}

  for (const exp of expenses) {
    if (exp.expense_type === 'shared') {
      const pct = leaseOwnerPcts[exp.lease_id] ?? 0
      if (pct <= 0) continue
      const ownerShare = exp.total_amount * pct
      const key = exp.category_name
      if (!expenseGroups[key]) expenseGroups[key] = { description: exp.category_name, total: 0 }
      expenseGroups[key].total += ownerShare
    } else if (exp.expense_type === 'owner_specific' && exp.owner_id === owner_id) {
      const key = exp.category_name + '|' + (exp.description ?? '')
      if (!expenseGroups[key]) expenseGroups[key] = { description: exp.description || exp.category_name, total: 0 }
      expenseGroups[key].total += exp.total_amount
    } else if (exp.expense_type === 'animal_specific' && exp.animal_id) {
      // Check if animal belongs to this owner
      const { data: animalRow } = await supabase
        .from('animals')
        .select('owner_id')
        .eq('id', exp.animal_id)
        .maybeSingle()
      if ((animalRow as { owner_id: string | null } | null)?.owner_id !== owner_id) continue
      const key = exp.category_name + '|' + exp.animal_id
      if (!expenseGroups[key]) expenseGroups[key] = { description: exp.description || exp.category_name, total: 0 }
      expenseGroups[key].total += exp.total_amount
    }
  }

  for (const [, grp] of Object.entries(expenseGroups)) {
    const amt = Math.round(grp.total * 100) / 100
    if (amt <= 0) continue
    lineItems.push({
      description: `${grp.description} (Q${expense_quarter} ${2000 + expense_year})`,
      quantity:    1,
      unit_price:  amt,
      amount:      amt,
    })
  }

  const total = Math.round(lineItems.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const ownerName = owner.company_name || owner.owner_name || owner.name

  // ── Step 7: Get invoice number ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: existingCount } = await (supabase as any)
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_quarter', billing_quarter)
    .gte('created_at', `20${String(billing_year).padStart(2, '0')}-01-01`)
    .lte('created_at', `20${String(billing_year).padStart(2, '0')}-12-31`)

  const sequence = (existingCount ?? 0) + 1
  const yy       = String(billing_year).padStart(2, '0')
  const qq       = String(billing_quarter).padStart(2, '0')
  const seq      = String(sequence).padStart(3, '0')
  const invoiceNumber = `${yy}${qq}${seq}`

  const preview = {
    invoice_number:   invoiceNumber,
    owner_name:       ownerName,
    head_count:       ownerHead,
    monthly_rate:     monthlyRate,
    quarterly_grazing: quarterlyGrazing,
    expense_count:    expenses.length,
    line_items:       lineItems,
    total,
  }

  if (dry_run) {
    return NextResponse.json({ preview })
  }

  // ── Step 8: Create the invoice ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error: invErr } = await (supabase as any)
    .from('invoices')
    .insert({
      owner_id,
      invoice_number:   invoiceNumber,
      invoice_quarter:  billing_quarter,
      invoice_sequence: sequence,
      period_start:     bStart,
      period_end:       bEnd,
      due_date:         due_date || null,
      line_items:       lineItems,
      total_amount:     total,
      status:           'draft',
      notes: `Q${billing_quarter} ${2000 + billing_year} grazing + Q${expense_quarter} ${2000 + expense_year} expenses`,
    })
    .select()
    .single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  return NextResponse.json({ invoice, preview }, { status: 201 })
}
