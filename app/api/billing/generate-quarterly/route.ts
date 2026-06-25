export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcOverlapDays } from '@/lib/lease-calculations'

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function quarterRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3
  const endMonth   = startMonth + 2
  const yy = 2000 + year
  const start = new Date(yy, startMonth, 1).toISOString().slice(0, 10)
  const end   = new Date(yy, endMonth + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

type LineItem = {
  description: string
  quantity: number | null
  unit_price: number | null
  amount: number
  is_header?: boolean
  share_note?: string
  expense_type?: string
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

  // ── Step 2: Fetch active contract for grazing rate ───────────────────────────
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

  const lineItems: LineItem[] = []

  if (ownerHead > 0 && monthlyRate > 0) {
    lineItems.push({
      description: `Grazing Per Head Per Month (Q${billing_quarter} ${2000 + billing_year} — ${bStartLabel} – ${bEndLabel})`,
      quantity:    ownerHead,
      unit_price:  monthlyRate,
      amount:      Math.round(quarterlyGrazing * 100) / 100,
    })
  }

  // ── Step 5: Expense quarter date range ──────────────────────────────────────
  const { start: eStart, end: eEnd } = quarterRange(expense_year, expense_quarter)

  // ── Step 6: Find all leases where owner had animals during expense quarter ──
  // Get owner's animals first (avoid non-existent owner_id on grazing_assignments)
  const { data: ownerAnimals } = await supabase
    .from('animals')
    .select('id')
    .eq('owner_id', owner_id)
    .eq('status', 'active')

  const ownerAnimalIds = (ownerAnimals ?? []).map((a: { id: string }) => a.id)

  type AssignRow = { animal_id: string; lease_id: string; start_date: string; end_date: string | null }

  let ownerAssignments: AssignRow[] = []
  if (ownerAnimalIds.length > 0) {
    const { data } = await supabase
      .from('grazing_assignments')
      .select('animal_id, lease_id, start_date, end_date')
      .in('animal_id', ownerAnimalIds)
      .lte('start_date', eEnd)
      .or(`end_date.is.null,end_date.gte.${eStart}`)
    ownerAssignments = (data ?? []) as AssignRow[]
  }

  const ownerLeaseIds = [...new Set(ownerAssignments.map(a => a.lease_id))]

  // ── Step 7: Per-lease expense calculation ────────────────────────────────────
  type ExpenseRow = {
    id: string; lease_id: string; expense_type: string
    category_name: string; description: string | null
    total_amount: number; owner_id: string | null; animal_id: string | null
    period_start: string | null; period_end: string | null
    expense_date: string | null
    include_calves: boolean | null
    expense_categories: { calculation_type: string | null } | null
  }

  type LeaseAnimalRow = { id: string; sex: string | null; owner_id: string | null; weaning_date: string | null; dam_id: string | null }

  const leaseExpenseGroups: Array<{
    lease_id: string
    lease_name: string
    line_items: LineItem[]
  }> = []

  for (const leaseId of ownerLeaseIds) {
    // Fetch lease details
    const { data: lease } = await supabase
      .from('leases')
      .select('id, property_name, is_home_ranch')
      .eq('id', leaseId)
      .maybeSingle()
    if (!lease) continue

    // Fetch expenses for this lease during expense quarter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawExpenses } = await (supabase as any)
      .from('lease_expenses')
      .select('id, lease_id, expense_type, category_name, description, total_amount, owner_id, animal_id, period_start, period_end, expense_date, include_calves, expense_categories(calculation_type)')
      .eq('lease_id', leaseId)
      .eq('quarter', expense_quarter)
      .eq('year', expense_year)

    const expenses = (rawExpenses ?? []) as ExpenseRow[]
    if (!expenses.length) continue

    // Fetch ALL assignments on this lease during expense quarter for animal-days
    const { data: allAssignData } = await supabase
      .from('grazing_assignments')
      .select('animal_id, start_date, end_date')
      .eq('lease_id', leaseId)
      .lte('start_date', eEnd)
      .or(`end_date.is.null,end_date.gte.${eStart}`)

    const allAssignments = (allAssignData ?? []) as AssignRow[]

    // Fetch animal details for all assigned animals
    const allAssignedIds = [...new Set(allAssignments.map(a => a.animal_id))]
    let leaseAnimalMap = new Map<string, LeaseAnimalRow>()
    if (allAssignedIds.length > 0) {
      const { data: animalData } = await supabase
        .from('animals')
        .select('id, sex, owner_id, weaning_date, dam_id')
        .in('id', allAssignedIds)
      for (const a of (animalData ?? []) as LeaseAnimalRow[]) leaseAnimalMap.set(a.id, a)
    }

    // Identify pair calves: unweaned calf whose dam is also assigned on this lease
    const assignedIdSet = new Set(allAssignments.map(a => a.animal_id))
    const pairCalfIds = new Set<string>()
    for (const [animalId, animal] of leaseAnimalMap) {
      if (
        animal.sex?.toLowerCase() === 'calf' &&
        !animal.weaning_date &&
        animal.dam_id &&
        assignedIdSet.has(animal.dam_id)
      ) {
        pairCalfIds.add(animalId)
      }
    }

    const leaseLineItems: LineItem[] = []

    for (const expense of expenses) {
      // Owner specific: only if this owner
      if (expense.expense_type === 'owner_specific') {
        if (expense.owner_id !== owner_id) continue
        leaseLineItems.push({
          description: expense.description || expense.category_name || 'Expense',
          quantity:    1,
          unit_price:  expense.total_amount,
          amount:      expense.total_amount,
          expense_type: 'owner_specific',
        })
        continue
      }

      // Animal specific: only if animal belongs to this owner
      if (expense.expense_type === 'animal_specific') {
        if (!expense.animal_id) continue
        const { data: animalRow } = await supabase
          .from('animals').select('owner_id').eq('id', expense.animal_id).maybeSingle()
        if ((animalRow as { owner_id: string | null } | null)?.owner_id !== owner_id) continue
        leaseLineItems.push({
          description: expense.description || expense.category_name || 'Expense',
          quantity:    1,
          unit_price:  expense.total_amount,
          amount:      expense.total_amount,
          expense_type: 'animal_specific',
        })
        continue
      }

      // Shared: calculate by animal-days
      const includeCaivesInSplit = Boolean(expense.include_calves)
      const calcType = expense.expense_categories?.calculation_type || 'period'
      let windowStart: string
      let windowEnd: string
      if (calcType === 'one_time') {
        windowStart = expense.expense_date || eStart
        windowEnd   = expense.expense_date || eEnd
      } else {
        windowStart = expense.period_start || eStart
        windowEnd   = expense.period_end   || eEnd
      }

      let ownerDays = 0
      let totalDays = 0

      for (const a of allAssignments) {
        // Skip pair calves unless include_calves is set
        if (!includeCaivesInSplit && pairCalfIds.has(a.animal_id)) continue

        const days = calcOverlapDays(a.start_date, a.end_date, windowStart, windowEnd)
        if (days <= 0) continue

        totalDays += days

        const animalOwner = leaseAnimalMap.get(a.animal_id)?.owner_id ?? null
        if (animalOwner === owner_id) ownerDays += days
      }

      if (totalDays === 0 || ownerDays === 0) continue

      const ownerShare = expense.total_amount * (ownerDays / totalDays)
      const sharePct   = ((ownerDays / totalDays) * 100).toFixed(1)

      leaseLineItems.push({
        description:  expense.description || expense.category_name || 'Expense',
        quantity:     1,
        unit_price:   Math.round(ownerShare * 100) / 100,
        amount:       Math.round(ownerShare * 100) / 100,
        expense_type: 'shared',
        share_note:   `${sharePct}% of $${Number(expense.total_amount).toFixed(2)}`,
      })
    }

    if (leaseLineItems.length > 0) {
      leaseExpenseGroups.push({
        lease_id:   leaseId,
        lease_name: (lease as { property_name: string }).property_name,
        line_items: leaseLineItems,
      })
    }
  }

  // ── Step 8: Build final line items with lease section headers ────────────────
  for (const group of leaseExpenseGroups) {
    lineItems.push({
      description: `── ${group.lease_name.toUpperCase()} EXPENSES (Q${expense_quarter} ${2000 + expense_year}) ──`,
      quantity:    null,
      unit_price:  null,
      amount:      0,
      is_header:   true,
    })
    for (const item of group.line_items) {
      lineItems.push(item)
    }
  }

  const total       = Math.round(lineItems.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const ownerName   = owner.company_name || owner.owner_name || owner.name
  const expenseCount = leaseExpenseGroups.reduce((s, g) => s + g.line_items.length, 0)

  // ── Step 9: Get invoice number ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: existingCount } = await (supabase as any)
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_quarter', billing_quarter)
    .gte('created_at', `20${String(billing_year).padStart(2, '0')}-01-01`)
    .lte('created_at', `20${String(billing_year).padStart(2, '0')}-12-31`)

  const sequence      = (existingCount ?? 0) + 1
  const yy            = String(billing_year).padStart(2, '0')
  const qq            = String(billing_quarter).padStart(2, '0')
  const seq           = String(sequence).padStart(3, '0')
  const invoiceNumber = `${yy}${qq}${seq}`

  const preview = {
    invoice_number:   invoiceNumber,
    owner_name:       ownerName,
    head_count:       ownerHead,
    monthly_rate:     monthlyRate,
    quarterly_grazing: quarterlyGrazing,
    expense_count:    expenseCount,
    line_items:       lineItems,
    total,
  }

  if (dry_run) {
    return NextResponse.json({ preview })
  }

  // ── Step 10: Create the invoice ──────────────────────────────────────────────
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
