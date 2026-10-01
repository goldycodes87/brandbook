export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'
import { generateReportPdfBuffer, type ReportSection } from '@/lib/generate-invoice-pdf'
import { buildOwnerPurchases } from '@/lib/owner-purchases'
import { fmtDate, fmtMoneyDecimals } from '@/lib/format'

type Params = { params: Promise<{ id: string }> }

async function buildReportData(id: string, year: number) {
  const supabase = createAdminClient()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  // Owner
  const { data: owner } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name, email, phone, address, city, state, zip')
    .eq('id', id)
    .maybeSingle()

  // Contract
  const { data: contract } = await supabase
    .from('grazing_contracts')
    .select('*')
    .eq('owner_id', id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Current herd — animals owned, active
  const { data: currentHerd } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, calf_sex, breed, dob, ear_tag_color, status')
    .eq('owner_id', id)
    .eq('status', 'active')
    .order('tag_number')

  // Dam IDs for this owner (to find calves)
  const { data: damRows } = await supabase
    .from('animals')
    .select('id')
    .eq('owner_id', id)
    .in('sex', ['cow', 'heifer'])

  const damIds = (damRows ?? []).map((r: { id: string }) => r.id)

  // Calves born this year from owner's dams
  type CalfRow = { id: string; tag_number: string; name: string | null; sex: string | null; calf_sex: string | null; dob: string | null; birth_weight_lbs: number | null; ear_tag_color: string | null; dam_id: string | null; sire_id: string | null; sire_library_id: string | null; status: string | null; disposition: string | null; disposition_date: string | null }
  let calvesBorn: CalfRow[] = []
  if (damIds.length > 0) {
    const { data } = await supabase
      .from('animals')
      .select('id, tag_number, name, sex, calf_sex, dob, birth_weight_lbs, ear_tag_color, dam_id, sire_id, sire_library_id, status, disposition, disposition_date')
      .in('dam_id', damIds)
      .gte('dob', yearStart)
      .lte('dob', yearEnd)
      .order('dob')
    calvesBorn = (data ?? []) as unknown as CalfRow[]
  }

  // Deaths this year (owner's animals that died)
  const { data: deaths } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, dob, disposition_date, cause_of_death')
    .eq('owner_id', id)
    .eq('status', 'deceased')
    .gte('disposition_date', yearStart)
    .lte('disposition_date', yearEnd)

  // Sales this year — must join through animal owner
  // First get all animal IDs that were/are owned by this owner
  const { data: ownerAnimals } = await supabase
    .from('animals')
    .select('id')
    .eq('owner_id', id)

  const ownerAnimalIds = (ownerAnimals ?? []).map((a: { id: string }) => a.id)

  let sales: Array<{ id: string; animal_id: string; sale_date: string; buyer: string | null; destination: string | null; gross_proceeds: number | null; sale_weight_lbs: number | null }> = []
  if (ownerAnimalIds.length > 0) {
    const { data } = await supabase
      .from('sales')
      .select('id, animal_id, sale_date, buyer, destination, gross_proceeds, sale_weight_lbs')
      .in('animal_id', ownerAnimalIds)
      .gte('sale_date', yearStart)
      .lte('sale_date', yearEnd)
      .order('sale_date', { ascending: false })
    sales = data ?? []
  }

  // Cattle that left this owner's hands by transfer — the operator's calf
  // share, or a sale to another owner on the same lease. Both land in
  // calf_transfers, and the counterparty is the difference between the two,
  // so the buyer's name is resolved rather than assumed to be the ranch.
  const { data: transferRows } = await supabase
    .from('calf_transfers')
    .select('*, animal:animal_id (id, tag_number, name, sex, calf_sex)')
    .eq('from_owner_id', id)
    .gte('transfer_date', yearStart)
    .lte('transfer_date', yearEnd)
    .order('transfer_date', { ascending: false })

  const buyerIds = [...new Set(
    (transferRows ?? [])
      .map((t: { to_owner_id?: string | null }) => t.to_owner_id)
      .filter((x): x is string => Boolean(x)),
  )]
  const buyerNames = new Map<string, string>()
  if (buyerIds.length > 0) {
    const { data: buyers } = await supabase
      .from('grazing_owners')
      .select('id, name, owner_name, company_name')
      .in('id', buyerIds)
    for (const b of (buyers ?? []) as Array<{ id: string; name: string | null; owner_name: string | null; company_name: string | null }>) {
      buyerNames.set(b.id, b.company_name || b.owner_name || b.name || 'the ranch')
    }
  }

  type TransferRow = {
    transfer_date: string | null
    fmv_at_transfer: number | null
    to_owner_id: string | null
    animal: { tag_number: string | null } | null
  }
  const transfers = ((transferRows ?? []) as unknown as TransferRow[]).map(t => ({
    ...t,
    to_owner_name: t.to_owner_id ? (buyerNames.get(t.to_owner_id) ?? 'the ranch') : 'the ranch',
  }))

  // Settlement for this year
  const { data: settlement } = await supabase
    .from('grazing_settlements')
    .select('*')
    .eq('owner_id', id)
    .eq('settlement_year', year)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Invoices for this year.
  //
  // line_items comes along because it is the only place the make-up of an
  // invoice is recorded — expense_allocations is not written by this billing
  // path — and a year-end report that shows a total with nothing behind it is
  // the report an owner rings up about.
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, period_start, period_end, total_amount, status, pdf_url, paid_amount, paid_at, payment_method, payment_reference, line_items')
    .eq('owner_id', id)
    .gte('period_start', yearStart)
    .lte('period_end', yearEnd)
    .order('period_start', { ascending: false })

  // Livestock bought this year. Same rules as the owner's own purchases
  // screen, because it is the same question asked from the other side of the
  // app.
  const allPurchases = await buildOwnerPurchases(id)
  const purchases = allPurchases.filter(p => p.date && p.date >= yearStart && p.date <= yearEnd)

  // Summary
  const grossSales = sales.reduce((s, x) => s + (x.gross_proceeds ?? 0), 0)
  const saleFeeAuction = contract?.sale_fee_auction_pct ?? 3
  const saleFeeFlat    = contract?.sale_fee_private_flat ?? 350

  // Per sale, on its own proceeds, at the rate its channel calls for.
  //
  // This read `sales.reduce((s) => s + grossSales * pct / 100, 0)`: it ignored
  // each sale's own amount and charged the percentage against the year's TOTAL
  // once per sale, so two sales billed twice the whole year's fee. It also
  // applied the auction percentage to private sales -- sale_fee_private_flat
  // was read from the contract and then never used.
  const isAuction = (destination: string | null) =>
    /barn|auction/i.test(destination ?? '')

  const saleFees = sales.reduce(
    (s, x) => s + (isAuction(x.destination)
      ? (x.gross_proceeds ?? 0) * saleFeeAuction / 100
      : saleFeeFlat),
    0,
  )
  const netProceeds = grossSales - saleFees

  // A draft was never issued and a void was taken back. Counting either as
  // money the owner owes is how a year-end report ends up arguing with the
  // invoices it was built from.
  const billable = (invoices ?? []).filter(
    (inv: { status: string | null }) => inv.status === 'sent' || inv.status === 'paid' || inv.status === 'approved',
  )
  const grazingFees = billable.reduce((s, inv) => s + (inv.total_amount ?? 0), 0)

  // What was actually settled. paid_amount is the record when it is there;
  // an invoice marked paid without one is taken at its full face value.
  const invoicesPaid = billable.reduce(
    (s, inv) => s + (inv.paid_amount ?? (inv.status === 'paid' ? (inv.total_amount ?? 0) : 0)),
    0,
  )

  const purchasesTotal = purchases.reduce((s, p) => s + (p.cost ?? 0), 0)
  const transfersOut   = (transfers ?? []).reduce(
    (s: number, t: { fmv_at_transfer?: number | null }) => s + (t.fmv_at_transfer ?? 0),
    0,
  )

  const moneyIn  = netProceeds + transfersOut
  const moneyOut = purchasesTotal + grazingFees

  const deathLossPct = calvesBorn.length > 0
    ? (deaths ?? []).length / calvesBorn.length * 100
    : 0

  return {
    owner,
    contract,
    year,
    current_herd:  currentHerd  ?? [],
    calves_born:   calvesBorn,
    deaths:        deaths        ?? [],
    sales,
    transfers:     transfers     ?? [],
    settlement:    settlement    ?? null,
    invoices:      invoices      ?? [],
    purchases,
    summary: {
      total_animals:   (currentHerd ?? []).length,
      calves_born:     calvesBorn.length,
      deaths:          (deaths ?? []).length,
      death_loss_pct:  Math.round(deathLossPct * 10) / 10,
      gross_sales:     grossSales,
      sale_fees:       Math.round(saleFees * 100) / 100,
      net_proceeds:    Math.round(netProceeds * 100) / 100,
      grazing_fees:    grazingFees,
      invoices_paid:   Math.round(invoicesPaid * 100) / 100,
      invoices_open:   Math.round((grazingFees - invoicesPaid) * 100) / 100,
      purchases_total: Math.round(purchasesTotal * 100) / 100,
      transfers_fmv:   Math.round(transfersOut * 100) / 100,
      money_in:        Math.round(moneyIn * 100) / 100,
      money_out:       Math.round(moneyOut * 100) / 100,
      net:             Math.round((moneyIn - moneyOut) * 100) / 100,
      balance_due:     settlement?.balance_due_to_operator ?? null,
    },
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const year = Number(req.nextUrl.searchParams.get('year') ?? new Date().getFullYear())

  try {
    const report = await buildReportData(id, year)
    return NextResponse.json({ data: report })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function generateAnnualReportPdf(id: string, year: number) {
  const supabase = createAdminClient()

  const report = await buildReportData(id, year)
  const { owner, contract, summary, current_herd, calves_born, deaths, sales, invoices, settlement, transfers, purchases } = report

  // Ranch name
  const { data: ranch } = await supabase.from('ranch_settings').select('ranch_name').limit(1).maybeSingle()
  const ranchName = (ranch as { ranch_name?: string } | null)?.ranch_name ?? 'Legacy Land and Cattle'

  const ownerData = owner as { company_name?: string | null; owner_name?: string | null; name?: string } | null
  const ownerName = ownerData
    ? (ownerData.company_name || ownerData.owner_name || ownerData.name || 'Owner')
    : 'Owner'

  const deathLossPct = summary.death_loss_pct
  // The colour chip went with the HTML. Who bears the loss is the part that
  // mattered, and it now reads as words on the line rather than a shade.
  const deathLossLabel = deathLossPct <= (contract?.death_loss_allowable_pct ?? 10) ? 'OWNER'
    : deathLossPct <= (contract?.death_loss_split_threshold_pct ?? 25) ? 'SPLIT'
    : 'OPERATOR'

  // This carried a thousands-separator regex with every backslash missing —
  // /B(?=(d{3})+(?!d))/ — so it matched a literal B and $11058.92 printed
  // without its comma on every report.
  const money = (n: number | null | undefined) =>
    n == null ? '—' : (n < 0 ? `-${fmtMoneyDecimals(-n)}` : fmtMoneyDecimals(n))
  const day = (d: string | null | undefined) => (d ? fmtDate(d) : '—')

  const grazingTotal      = summary.grazing_fees
  const saleFees          = summary.sale_fees
  const netCalfProceeds   = summary.net_proceeds
  const balanceDueToOp    = settlement?.balance_due_to_operator ?? 0
  const balanceDueToOwner = settlement?.balance_due_to_owner ?? 0
  const balanceLabel      = balanceDueToOp > 0 ? 'Balance due to the ranch' : 'Balance due to you'
  const balanceAmount     = balanceDueToOp > 0 ? balanceDueToOp : balanceDueToOwner

  type Herd     = { tag_number: string; sex?: string | null; breed?: string | null; dob?: string | null; status?: string | null }
  type Calf     = { tag_number: string; calf_sex?: string | null; dob?: string | null; birth_weight_lbs?: number | null; status?: string | null; disposition?: string | null }
  type Death    = { tag_number: string; disposition_date?: string | null; cause_of_death?: string | null }
  type Sale     = { animal_id: string; sale_date: string; buyer?: string | null; destination?: string | null; gross_proceeds?: number | null }
  type LineItem = { description?: string | null; amount?: number | null; expense_type?: string | null; is_header?: boolean | null; is_subtotal?: boolean | null }
  type Inv      = {
    invoice_number?: string | null; period_start?: string | null; period_end?: string | null
    total_amount?: number | null; status?: string | null
    paid_amount?: number | null; paid_at?: string | null
    payment_method?: string | null; payment_reference?: string | null
    line_items?: LineItem[] | null
  }
  type TransferOut = {
    transfer_date?: string | null; fmv_at_transfer?: number | null; transfer_type?: string | null
    to_owner_name?: string | null; animal?: { tag_number?: string | null } | null
  }
  type Purchase = { date: string | null; description: string; tag: string; cost: number | null; seller: string | null }

  const sections: ReportSection[] = []

  // ── The year in figures ───────────────────────────────────────────────────
  sections.push({
    heading: `${year} AT A GLANCE`,
    rows: [
      { label: 'Owner',            value: ownerName },
      { label: 'Ranch',            value: ranchName },
      { label: 'Head at year end', value: String(summary.total_animals) },
      { label: 'Calves born',      value: String(summary.calves_born) },
      { label: 'Deaths',           value: `${summary.deaths}  (${deathLossPct}% — ${deathLossLabel} bears it)` },
    ],
  })

  // ── Money in, money out ───────────────────────────────────────────────────
  //
  // A year-end report that lists invoices and stops is a bill, not a report.
  // What the owner wants to know is what he took in, what he laid out, and
  // which way the year went. The detail sections below each one are the
  // make-up of these figures, never an addition to them.
  const purchaseRows = purchases as Purchase[]
  const invs         = invoices  as Inv[]
  const billable     = invs.filter(i => i.status === 'sent' || i.status === 'paid' || i.status === 'approved')

  const transfersOut = transfers as TransferOut[]

  sections.push({
    heading: `MONEY IN — ${year}`,
    rows: [
      { label: 'Gross cattle sales',  value: money(summary.gross_sales) },
      { label: 'Less: selling fees',  value: money(-saleFees) },
      { label: 'Net sale proceeds',   value: money(netCalfProceeds) },
      ...(summary.transfers_fmv > 0
        ? [{ label: `Cattle transferred out (${transfersOut.length} head)`, value: money(summary.transfers_fmv) }]
        : []),
      { label: 'Total money in',      value: money(summary.money_in) },
    ],
  })

  sections.push({
    heading: `MONEY OUT — ${year}`,
    rows: [
      { label: 'Cattle purchased',           value: money(summary.purchases_total) },
      { label: 'Grazing and expenses billed', value: money(grazingTotal) },
      { label: 'Total money out',            value: money(summary.money_out) },
      { label: '   of which paid',           value: money(summary.invoices_paid + summary.purchases_total) },
      { label: '   still outstanding',       value: money(summary.invoices_open) },
    ],
  })

  sections.push({
    heading: `NET FOR ${year}`,
    rows: [
      { label: 'Money in',  value: money(summary.money_in) },
      { label: 'Money out', value: money(summary.money_out) },
      {
        label: summary.net >= 0 ? 'Net in your favour' : 'Net out of pocket',
        value: money(Math.abs(summary.net)),
      },
    ],
  })

  // ── Cattle that went out ──────────────────────────────────────────────────
  if (transfersOut.length > 0) {
    sections.push({
      heading: `CATTLE TRANSFERRED OUT — ${transfersOut.length}`,
      rows: [],
      table: {
        columns: ['Date', 'Tag', 'To', 'Value'],
        align:   ['left', 'left', 'left', 'right'],
        rows: [
          ...transfersOut.map(t => [
            day(t.transfer_date),
            t.animal?.tag_number ? `#${t.animal.tag_number}` : '—',
            t.to_owner_name ?? 'the ranch',
            money(t.fmv_at_transfer),
          ]),
          ['', '', 'Total', money(summary.transfers_fmv)],
        ],
      },
    })
  }

  // ── Cattle bought ─────────────────────────────────────────────────────────
  if (purchaseRows.length > 0) {
    sections.push({
      heading: `CATTLE PURCHASED — ${purchaseRows.length}`,
      rows: [],
      table: {
        columns: ['Date', 'What', 'Tag', 'Seller', 'Cost'],
        align:   ['left', 'left', 'left', 'left', 'right'],
        rows: [
          ...purchaseRows.map(p => [
            day(p.date), p.description, p.tag, p.seller ?? 'not recorded',
            p.cost != null ? money(p.cost) : '—',
          ]),
          ['', '', '', 'Total', money(summary.purchases_total)],
        ],
      },
    })
  }

  // ── What the billing was made of ──────────────────────────────────────────
  //
  // Rolled up out of the invoices' own line items rather than recomputed from
  // the expense tables: these are the figures the owner was actually sent, and
  // a report that derives its own can disagree with the invoice in his hand.
  const strip = (d: string) => {
    let s = d, prev = ''
    while (s !== prev) { prev = s; s = s.replace(/\s*\([^()]*\)\s*$/, '') }
    return s.trim() || d
  }
  const groupOf = (li: LineItem) =>
    li.expense_type === 'shared' ? 'Herd share'
      : li.expense_type === 'owner_specific' || li.expense_type === 'animal_specific' ? 'Your animals'
      : /^grazing/i.test(li.description ?? '') ? 'Grazing'
      : 'Other'

  const ORDER = ['Grazing', 'Herd share', 'Your animals', 'Other']
  const rolled = new Map<string, { group: string; label: string; total: number }>()
  let rolledTotal = 0

  for (const inv of billable) {
    const items = Array.isArray(inv.line_items) ? inv.line_items : []
    if (items.length === 0) {
      // No breakdown recorded — the total still has to appear somewhere or
      // the section quietly loses money.
      const key = `Other|Invoice ${inv.invoice_number ?? '—'}`
      const cur = rolled.get(key) ?? { group: 'Other', label: `Invoice ${inv.invoice_number ?? '—'}`, total: 0 }
      cur.total += inv.total_amount ?? 0
      rolled.set(key, cur)
      rolledTotal += inv.total_amount ?? 0
      continue
    }
    for (const li of items) {
      if (li.is_header || li.is_subtotal) continue
      const amt = li.amount ?? 0
      if (!amt) continue
      const group = groupOf(li)
      const label = strip(li.description ?? 'Unlabelled')
      const key   = `${group}|${label}`
      const cur   = rolled.get(key) ?? { group, label, total: 0 }
      cur.total += amt
      rolled.set(key, cur)
      rolledTotal += amt
    }
  }

  if (rolled.size > 0) {
    const entries = [...rolled.values()].sort((a, b) =>
      ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || b.total - a.total)

    const rows = entries.map(e => [e.group, e.label, money(e.total)])

    // If the parts do not add to the whole, say so on the page rather than
    // let the reader find it. A silent difference here is the argument this
    // report is meant to prevent.
    const diff = Math.round((grazingTotal - rolledTotal) * 100) / 100
    if (Math.abs(diff) >= 0.01) {
      rows.push(['Other', 'Not itemised on the invoice', money(diff)])
    }
    rows.push(['', 'Total billed', money(grazingTotal)])

    sections.push({
      heading: 'WHAT THE BILLING WAS FOR',
      rows: [],
      table: {
        columns: ['Group', 'Item', 'Amount'],
        align:   ['left', 'left', 'right'],
        rows,
      },
    })
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const paidInvs = billable.filter(i => i.paid_at || i.status === 'paid')
  if (paidInvs.length > 0) {
    sections.push({
      heading: 'PAYMENTS RECEIVED',
      rows: [],
      table: {
        columns: ['Date', 'Invoice', 'Method', 'Reference', 'Amount'],
        align:   ['left', 'left', 'left', 'left', 'right'],
        rows: [
          ...paidInvs.map(i => [
            i.paid_at ? fmtDate(i.paid_at.slice(0, 10)) : '—',
            i.invoice_number ?? '—',
            i.payment_method ?? '—',
            i.payment_reference ?? '—',
            money(i.paid_amount ?? i.total_amount),
          ]),
          ['', '', '', 'Total received', money(summary.invoices_paid)],
        ],
      },
    })
  }

  // ── Settlement ────────────────────────────────────────────────────────────
  //
  // Only when the year has actually been settled. Printed unconditionally it
  // showed a run of zeroes and a "Balance due to you: $0.00" for every owner
  // whose year is still open — a figure that looks settled and is not.
  if (settlement) {
    const moneyRows: Array<{ label: string; value: string }> = [
      { label: 'Gross calf sales',   value: money(summary.gross_sales) },
      { label: 'Less: selling fees', value: money(-saleFees) },
      { label: 'Net proceeds',       value: money(netCalfProceeds) },
      { label: 'Grazing invoiced',   value: money(grazingTotal) },
      {
        label: settlement.death_loss_responsibility === 'operator'
          ? 'Death loss absorbed by the operator'
          : 'Death loss',
        value: money(settlement.operator_death_loss_share),
      },
    ]
    if (transfersOut.length > 0) {
      moneyRows.push({ label: 'Less: calf transfers at FMV', value: money(-(settlement.calf_transfers_fmv ?? 0)) })
    }
    moneyRows.push({ label: balanceLabel, value: money(balanceAmount) })
    if (settlement.shortfall_carried_forward) {
      moneyRows.push({
        label: 'Carried forward to next year',
        value: `${settlement.shortfall_carried_forward} calf(ves)`,
      })
    }
    sections.push({
      heading: settlement.is_settled ? 'SETTLEMENT' : 'SETTLEMENT (DRAFT — NOT YET SETTLED)',
      rows: moneyRows,
    })
  }

  // ── The herd ──────────────────────────────────────────────────────────────
  const herd = current_herd as Herd[]
  if (herd.length > 0) {
    sections.push({
      heading: `HERD AT YEAR END — ${herd.length} HEAD`,
      rows: [],
      table: {
        columns: ['Tag', 'Sex', 'Breed', 'Born', 'Status'],
        align:   ['left', 'left', 'left', 'left', 'left'],
        rows: herd.map(a => [`#${a.tag_number}`, a.sex ?? '—', a.breed ?? '—', day(a.dob), a.status ?? '—']),
      },
    })
  }

  const calves = calves_born as Calf[]
  if (calves.length > 0) {
    sections.push({
      heading: `CALVES BORN — ${calves.length}`,
      rows: [],
      table: {
        columns: ['Tag', 'Sex', 'Born', 'Birth wt', 'Status'],
        align:   ['left', 'left', 'left', 'right', 'left'],
        rows: calves.map(c => [
          `#${c.tag_number}`, c.calf_sex ?? '—', day(c.dob),
          c.birth_weight_lbs ? `${c.birth_weight_lbs} lb` : '—',
          c.disposition ?? c.status ?? 'active',
        ]),
      },
    })
  }

  // ── What left ─────────────────────────────────────────────────────────────
  const departures = [
    ...(deaths as Death[]).map(d => [`#${d.tag_number}`, day(d.disposition_date), 'Died', d.cause_of_death ?? '—', '—']),
    ...(sales as Sale[]).map(x => [`#${x.animal_id}`, day(x.sale_date), 'Sold', x.buyer ?? x.destination ?? '—', money(x.gross_proceeds)]),
  ]
  if (departures.length > 0) {
    sections.push({
      heading: 'WHAT LEFT THE HERD',
      rows: [],
      table: {
        columns: ['Tag', 'Date', 'How', 'To / cause', 'Proceeds'],
        align:   ['left', 'left', 'left', 'left', 'right'],
        rows: departures,
      },
    })
  }

  // ── Billing ───────────────────────────────────────────────────────────────
  // Every invoice raised in the year, drafts and voids included, so the list
  // matches what the owner sees in his portal. The money figures above count
  // only the issued ones.
  if (invs.length > 0) {
    sections.push({
      heading: 'INVOICES',
      rows: [],
      table: {
        columns: ['Invoice', 'Period', 'Status', 'Amount'],
        align:   ['left', 'left', 'left', 'right'],
        rows: invs.map(i => [
          i.invoice_number ?? '—',
          `${day(i.period_start)} - ${day(i.period_end)}`,
          i.status ?? '—',
          money(i.total_amount),
        ]),
      },
    })
  }

  const pdfBuffer = await generateReportPdfBuffer(
    `${ownerName} - ${year} Annual Report`,
    sections,
  )
  const pdfKey = `reports/grazing/${id}-${year}-annual.pdf`
  const pdfUrl = await uploadToR2(pdfKey, pdfBuffer, 'application/pdf')

  // Update settlement pdf_url if settlement exists
  if (settlement?.id) {
    await supabase
      .from('grazing_settlements')
      .update({ pdf_url: pdfUrl })
      .eq('id', settlement.id)
  }

  return { pdf_url: pdfUrl }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const year = Number(body.year ?? new Date().getFullYear())
  return NextResponse.json(await generateAnnualReportPdf(id, year))
}
