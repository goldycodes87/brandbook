export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadQuarterAllocations, quarterRange, type ExpenseMeta } from '@/lib/expense-allocation-data'
import type { Allocation } from '@/lib/expense-allocation'
import { fmtDate } from '@/lib/format'

type LineItem = {
  description: string
  quantity: number | null
  unit_price: number | null
  amount: number
  is_header?: boolean
  share_note?: string
  expense_type?: string
  is_whole_herd?: boolean
}

function lineItemFor(alloc: Allocation, meta: ExpenseMeta): LineItem {
  return {
    description:  meta.description || meta.category_name || 'Expense',
    quantity:     1,
    unit_price:   alloc.amount,
    amount:       alloc.amount,
    expense_type: alloc.kind,
    ...(alloc.share_note ? { share_note: alloc.share_note } : {}),
    ...(meta.is_lease_specific ? {} : { is_whole_herd: true }),
  }
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
  const { data: owner } = await supabase
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

  // ── Step 3: Fetch active owner animals ───────────────────────────────────────
  const { data: ownerAnimalsAll } = await supabase
    .from('animals')
    .select('id, sex, weaning_date, dam_id')
    .eq('owner_id', owner_id)
    .eq('status', 'active')

  type OwnerAnimal = { id: string; sex: string | null; weaning_date: string | null; dam_id: string | null }
  const ownerAnimalsFull = (ownerAnimalsAll ?? []) as unknown as OwnerAnimal[]
  const ownerAnimalIdSet = new Set(ownerAnimalsFull.map(a => a.id))

  const billingPairCalves = ownerAnimalsFull.filter(a =>
    a.sex?.toLowerCase() === 'calf' &&
    !a.weaning_date &&
    a.dam_id &&
    ownerAnimalIdSet.has(a.dam_id)
  )
  const billableUnits    = ownerAnimalsFull.length - billingPairCalves.length
  const quarterlyGrazing = billableUnits * monthlyRate * 3

  const sexBreakdown: Record<string, number> = {}
  for (const a of ownerAnimalsFull) {
    const sex = (a.sex || 'other').toLowerCase()
    sexBreakdown[sex] = (sexBreakdown[sex] || 0) + 1
  }

  // ── Step 4: Billing quarter date range ──────────────────────────────────────
  const { start: bStart, end: bEnd } = quarterRange(billing_year, billing_quarter)
  const bStartLabel = fmtDate(bStart)
  const bEndLabel   = fmtDate(bEnd)

  const lineItems: LineItem[] = []

  if (billableUnits > 0 && monthlyRate > 0) {
    const pairNote = billingPairCalves.length > 0
      ? ` (${billingPairCalves.length} pair calf${billingPairCalves.length > 1 ? 's' : ''} counted as 1 unit with dam)`
      : ''
    lineItems.push({
      description: `Grazing Per Head/Month (Q${billing_quarter} ${2000 + billing_year} — ${bStartLabel} – ${bEndLabel})${pairNote}`,
      quantity:    billableUnits,
      unit_price:  monthlyRate,
      amount:      Math.round(quarterlyGrazing * 100) / 100,
    })
  }

  // ── Step 5: Expense quarter — every owner's share, computed once ─────────────
  //
  // The herd-days math lives in lib/expense-allocation.ts and nowhere else. The
  // pending view calls the same loader with the same arguments, so a share
  // cannot read one way on screen and another on the invoice.
  const { start: eStart, end: eEnd } = quarterRange(expense_year, expense_quarter)

  const { allocations, expenses, herdDays } = await loadQuarterAllocations(supabase, {
    quarter:     expense_quarter,
    year:        expense_year,
    windowStart: eStart,
    windowEnd:   eEnd,
  })

  const ownerAllocationsAll = allocations.filter(a => a.owner_id === owner_id && a.amount !== 0)

  // Drop anything this owner has already been charged for on a live invoice —
  // a hauling bill sent early as a one-off, say. The database refuses it either
  // way; filtering here means one early charge trims a line off this invoice
  // instead of blocking the whole quarter.
  const billedElsewhere = new Map<string, string>()
  if (ownerAllocationsAll.length > 0) {
    const { data: priorRows } = await supabase
      .from('expense_allocations')
      .select('expense_id, invoices(invoice_number, status)')
      .eq('owner_id', owner_id)
      .in('expense_id', ownerAllocationsAll.map(a => a.expense_id))

    const prior = (priorRows ?? []) as unknown as Array<{
      expense_id: string
      invoices: { invoice_number: string | null; status: string | null } | null
    }>

    for (const row of prior) {
      if (row.invoices && row.invoices.status !== 'void') {
        billedElsewhere.set(row.expense_id, row.invoices.invoice_number ?? 'an earlier invoice')
      }
    }
  }

  const ownerAllocations   = ownerAllocationsAll.filter(a => !billedElsewhere.has(a.expense_id))
  const excludedAsBilled   = ownerAllocationsAll
    .filter(a => billedElsewhere.has(a.expense_id))
    .map(a => ({
      expense_id:  a.expense_id,
      amount:      a.amount,
      description: expenses.get(a.expense_id)?.description
                ?? expenses.get(a.expense_id)?.category_name
                ?? 'Expense',
      on_invoice:  billedElsewhere.get(a.expense_id)!,
    }))

  const ownerHerdDays = herdDays.byOwner.get(owner_id) ?? 0
  const ownerHerdPct  = herdDays.total > 0 ? ownerHerdDays / herdDays.total : 0

  // ── Step 6: Group this owner's shares into line items ───────────────────────
  const wholeHerdLineItems: LineItem[] = []
  const leaseGroups = new Map<string, { lease_name: string; line_items: LineItem[] }>()

  // Every SINGLE-OWNER lease_expenses row on this invoice. Shared rows are
  // pro-rated across several owners and invoice_id is one column, so they are
  // tracked in expense_allocations instead — see the upsert at the end.
  const billedExpenseIds = new Set<string>()

  for (const alloc of ownerAllocations) {
    const meta = expenses.get(alloc.expense_id)
    if (!meta) continue

    if (alloc.kind !== 'shared') billedExpenseIds.add(alloc.expense_id)

    if (!meta.is_lease_specific) {
      wholeHerdLineItems.push(lineItemFor(alloc, meta))
      continue
    }

    const key   = meta.lease_id ?? 'unknown'
    const group = leaseGroups.get(key) ?? { lease_name: meta.lease_name ?? 'Lease', line_items: [] }
    group.line_items.push(lineItemFor(alloc, meta))
    leaseGroups.set(key, group)
  }

  // ── Step 7: Build final line items ───────────────────────────────────────────
  if (wholeHerdLineItems.length > 0) {
    lineItems.push({
      description: `- Q${expense_quarter} ${2000 + expense_year} EXPENSES (WHOLE HERD) -`,
      quantity:    null,
      unit_price:  null,
      amount:      0,
      is_header:   true,
    })
    lineItems.push(...wholeHerdLineItems)
  }

  if (leaseGroups.size > 0) {
    lineItems.push({
      description: `- Q${expense_quarter} ${2000 + expense_year} LEASE EXPENSES -`,
      quantity:    null,
      unit_price:  null,
      amount:      0,
      is_header:   true,
    })
    for (const group of leaseGroups.values()) {
      for (const item of group.line_items) {
        lineItems.push({ ...item, description: `${item.description} (${group.lease_name})` })
      }
    }
  }

  const total        = Math.round(lineItems.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const ownerName    = owner.company_name || owner.owner_name || owner.name
  const expenseCount = ownerAllocations.length

  // ── Step 8: Get invoice number ───────────────────────────────────────────────
  //
  // Highest sequence so far, not how many rows exist. count(*) + 1 reuses a
  // number the moment an invoice is voided or deleted, and invoice_number is
  // uniquely indexed, so the next generate would fail with a raw 500.
  const { data: lastSeq } = await supabase
    .from('invoices')
    .select('invoice_sequence')
    .eq('invoice_quarter', billing_quarter)
    .gte('created_at', `20${String(billing_year).padStart(2, '0')}-01-01`)
    .lte('created_at', `20${String(billing_year).padStart(2, '0')}-12-31`)
    .order('invoice_sequence', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const sequence      = ((lastSeq as { invoice_sequence: number | null } | null)?.invoice_sequence ?? 0) + 1
  const yy            = String(billing_year).padStart(2, '0')
  const qq            = String(billing_quarter).padStart(2, '0')
  const seq           = String(sequence).padStart(3, '0')
  const invoiceNumber = `${yy}${qq}${seq}`

  const preview = {
    invoice_number:    invoiceNumber,
    owner_name:        ownerName,
    head_count:        billableUnits,
    monthly_rate:      monthlyRate,
    quarterly_grazing: quarterlyGrazing,
    expense_count:     expenseCount,
    line_items:        lineItems,
    total,
    sex_breakdown:     sexBreakdown,
    pair_calves:       billingPairCalves.length,
    herd_pct:          Math.round(ownerHerdPct * 1000) / 10,
    // Shown so a trimmed invoice reads as deliberate rather than as a
    // number that quietly came up short.
    excluded_already_billed: excludedAsBilled,
  }

  // ── Step 9: Has this owner already been billed for this expense quarter? ────
  //
  // The unique index invoices_one_per_owner_expense_quarter is the guarantee.
  // This lookup exists to turn its 23505 into a sentence a person can act on,
  // and to warn in a dry run before anybody presses the button.
  const expYY = expense_year % 100
  const { data: alreadyBilledRows } = await supabase
    .from('invoices')
    .select('invoice_number, status, total_amount, created_at')
    .eq('owner_id', owner_id)
    .eq('expense_quarter', expense_quarter)
    .eq('expense_year', expYY)
    .neq('status', 'void')
    .limit(1)

  const alreadyBilled = (alreadyBilledRows ?? [])[0] ?? null

  if (dry_run) {
    return NextResponse.json({ preview: { ...preview, already_billed: alreadyBilled } })
  }

  if (alreadyBilled) {
    return NextResponse.json(
      {
        error:
          `${ownerName} was already invoiced for Q${expense_quarter} ${2000 + expYY} expenses ` +
          `on invoice ${alreadyBilled.invoice_number} (${alreadyBilled.status}). ` +
          `Void that invoice if it needs reissuing.`,
        existing_invoice: alreadyBilled,
      },
      { status: 409 },
    )
  }

  // ── Step 10: Create the invoice, its allocations and the stamps atomically ──
  //
  // One transaction inside Postgres. These used to be three separate writes
  // with the last two non-fatal, which is how the June 2026 invoices ended up
  // with no record of which expenses they covered — the invoice was real, the
  // evidence was not. Now either all three land or none do.
  //
  // Only this owner's shares are frozen. Everyone else's stays pending and
  // keeps recomputing from live herd-days; storing it now would freeze a
  // number that changes the moment an animal moves.
  const { data: invoice, error: invErr } = await supabase.rpc('create_quarterly_invoice', {
    p_owner_id:           owner_id,
    p_invoice_number:     invoiceNumber,
    p_invoice_quarter:    billing_quarter,
    p_invoice_sequence:   sequence,
    p_period_start:       bStart,
    p_period_end:         bEnd,
    ...(due_date ? { p_due_date: due_date } : {}),
    p_line_items:         lineItems,
    p_total:              total,
    p_notes:              `Q${billing_quarter} ${2000 + billing_year} grazing + Q${expense_quarter} ${2000 + expYY} expenses`,
    p_expense_quarter:    expense_quarter,
    p_expense_year:       expYY,
    p_allocations:        ownerAllocations.map(a => ({
      expense_id: a.expense_id,
      owner_id:   a.owner_id,
      amount:     a.amount,
      share_note: a.share_note,
    })),
    p_billed_expense_ids: [...billedExpenseIds],
  })

  if (invErr) {
    // Lost the race between the check above and the insert.
    if (invErr.code === '23505' && invErr.message.includes('invoices_one_per_owner_expense_quarter')) {
      return NextResponse.json(
        { error: `${ownerName} already has a live invoice for Q${expense_quarter} ${2000 + expYY} expenses.` },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: invErr.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      invoice,
      preview,
      expenses_linked:     billedExpenseIds.size,
      allocations_written: ownerAllocations.length,
    },
    { status: 201 },
  )
}
