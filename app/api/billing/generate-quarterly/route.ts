export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadQuarterAllocations, quarterRange, type ExpenseMeta } from '@/lib/expense-allocation-data'
import type { Allocation } from '@/lib/expense-allocation'
import { fmtDate } from '@/lib/format'
import { buildExpenseSections, invoiceTotal, type LineItem } from '@/lib/invoice-line-items'

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
    expenses_only = false,
  }: {
    owner_id: string
    billing_quarter: number
    billing_year: number
    expense_quarter: number
    expense_year: number
    due_date: string
    dry_run?: boolean
    /** Bill the expense quarter alone — no grazing for the coming quarter. */
    expenses_only?: boolean
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

  // An owner who is leaving still owes for the quarter that has finished, but
  // must not be charged grazing for one they will not be here for. Without
  // this the generator bills head count as it stands today, which for a man
  // selling out is exactly the wrong number.
  if (!expenses_only && billableUnits > 0 && monthlyRate > 0) {
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
  //
  // Collected first, grouped after. Grouping needs to see every share in a
  // category at once to know whether they are uniform, so a line cannot be
  // built one allocation at a time.
  const wholeHerdRows: Array<{ alloc: Allocation; meta: ExpenseMeta }> = []
  const leaseRows = new Map<string, { lease_name: string; rows: Array<{ alloc: Allocation; meta: ExpenseMeta }> }>()

  // Every SINGLE-OWNER lease_expenses row on this invoice. Shared rows are
  // pro-rated across several owners and invoice_id is one column, so they are
  // tracked in expense_allocations instead — see the upsert at the end.
  const billedExpenseIds = new Set<string>()

  for (const alloc of ownerAllocations) {
    const meta = expenses.get(alloc.expense_id)
    if (!meta) continue

    if (alloc.kind !== 'shared') billedExpenseIds.add(alloc.expense_id)

    if (!meta.is_lease_specific) {
      wholeHerdRows.push({ alloc, meta })
      continue
    }

    const key   = meta.lease_id ?? 'unknown'
    const group = leaseRows.get(key) ?? { lease_name: meta.lease_name ?? 'Lease', rows: [] }
    group.rows.push({ alloc, meta })
    leaseRows.set(key, group)
  }

  // ── Step 7: Build final line items ───────────────────────────────────────────
  //
  // Sectioned by what kind of cost it is, with a subtotal under each, because
  // that is how a bill gets checked: agree the herd percentage, agree the work
  // on your own animals, then agree the sum. Lease-specific rows keep their
  // property name in the description rather than getting a section of their
  // own — the lease matters for WHICH herd split applies, not for how the
  // money is read.
  const tagsById = new Map<string, string>()
  const animalIds = [...new Set(
    [...wholeHerdRows, ...[...leaseRows.values()].flatMap(g => g.rows)]
      .map(r => r.meta.animal_id).filter((x): x is string => Boolean(x)),
  )]
  if (animalIds.length > 0) {
    const { data: tagRows } = await supabase
      .from('animals').select('id, tag_number').in('id', animalIds)
    for (const a of (tagRows ?? []) as Array<{ id: string; tag_number: string }>) {
      tagsById.set(a.id, a.tag_number)
    }
  }

  const leaseLabelled = [...leaseRows.values()].flatMap(g =>
    g.rows.map(r => ({ ...r, meta: { ...r.meta, category_name: `${r.meta.category_name ?? 'Expense'} (${g.lease_name})` } })),
  )

  lineItems.push(...buildExpenseSections([...wholeHerdRows, ...leaseLabelled], {
    quarter: expense_quarter,
    year:    expense_year,
    herdPct: ownerHerdPct * 100,
    tags:    tagsById,
  }))

  // Headers carry no money and subtotals carry money already counted above
  // them — summing the array raw would bill every expense twice.
  const total        = invoiceTotal(lineItems)
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
    // So a dry run reads as "no grazing on purpose" rather than looking short.
    expenses_only,
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
    // An expenses-only invoice covers the quarter that has finished, not the
    // one being billed ahead, so it carries that period and says so. Stamping
    // it with the grazing quarter would put a period on the page that nothing
    // on the page belongs to.
    p_period_start:       expenses_only ? eStart : bStart,
    p_period_end:         expenses_only ? eEnd   : bEnd,
    ...(due_date ? { p_due_date: due_date } : {}),
    p_line_items:         lineItems,
    p_total:              total,
    p_notes: expenses_only
      ? `Q${expense_quarter} ${2000 + expYY} expenses only — no grazing billed`
      : `Q${billing_quarter} ${2000 + billing_year} grazing + Q${expense_quarter} ${2000 + expYY} expenses`,
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
