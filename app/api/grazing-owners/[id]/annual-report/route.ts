export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'
import { generatePDF } from '@/lib/generate-invoice-pdf'

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
    calvesBorn = (data ?? []) as CalfRow[]
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

  // Calf transfers this year
  const { data: transfers } = await supabase
    .from('calf_transfers')
    .select('*, animal:animal_id (id, tag_number, name, sex, calf_sex)')
    .eq('from_owner_id', id)
    .gte('transfer_date', yearStart)
    .lte('transfer_date', yearEnd)
    .order('transfer_date', { ascending: false })

  // Settlement for this year
  const { data: settlement } = await supabase
    .from('grazing_settlements')
    .select('*')
    .eq('owner_id', id)
    .eq('settlement_year', year)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Invoices for this year
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, period_start, period_end, total_amount, status, pdf_url')
    .eq('owner_id', id)
    .gte('period_start', yearStart)
    .lte('period_end', yearEnd)
    .order('period_start', { ascending: false })

  // Summary
  const grossSales = sales.reduce((s, x) => s + (x.gross_proceeds ?? 0), 0)
  const saleFeeAuction = contract?.sale_fee_auction_pct ?? 3
  const saleFeeFlat    = contract?.sale_fee_private_flat ?? 350
  const saleFees = sales.reduce((s) => s + (grossSales * saleFeeAuction / 100), 0)
  const netProceeds = grossSales - saleFees
  const grazingFees = (invoices ?? []).reduce((s, inv) => s + (inv.total_amount ?? 0), 0)
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
    summary: {
      total_animals:   (currentHerd ?? []).length,
      calves_born:     calvesBorn.length,
      deaths:          (deaths ?? []).length,
      death_loss_pct:  Math.round(deathLossPct * 10) / 10,
      gross_sales:     grossSales,
      sale_fees:       Math.round(saleFees * 100) / 100,
      net_proceeds:    Math.round(netProceeds * 100) / 100,
      grazing_fees:    grazingFees,
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

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const year = Number(body.year ?? new Date().getFullYear())
  const supabase = createAdminClient()

  const report = await buildReportData(id, year)
  const { owner, contract, summary, current_herd, calves_born, deaths, sales, invoices, settlement, transfers } = report

  // Ranch name
  const { data: ranch } = await supabase.from('ranch_settings').select('ranch_name').limit(1).maybeSingle()
  const ranchName = (ranch as { ranch_name?: string } | null)?.ranch_name ?? 'Legacy Land and Cattle'

  const ownerData = owner as { company_name?: string | null; owner_name?: string | null; name?: string } | null
  const ownerName = ownerData
    ? (ownerData.company_name || ownerData.owner_name || ownerData.name || 'Owner')
    : 'Owner'

  function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  function fmtMoney(n: number | null | undefined) {
    return '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const deathLossPct = summary.death_loss_pct
  const deathLossChip = deathLossPct <= (contract?.death_loss_allowable_pct ?? 10) ? 'success'
    : deathLossPct <= (contract?.death_loss_split_threshold_pct ?? 25) ? 'warning'
    : 'danger'
  const deathLossLabel = deathLossPct <= (contract?.death_loss_allowable_pct ?? 10) ? 'OWNER'
    : deathLossPct <= (contract?.death_loss_split_threshold_pct ?? 25) ? 'SPLIT'
    : 'OPERATOR'

  const currentHerdRows = (current_herd as Array<{ tag_number: string; sex?: string | null; breed?: string | null; dob?: string | null; status?: string | null }>).map(a =>
    `<tr><td>#${a.tag_number}</td><td>${a.sex ?? '—'}</td><td>${a.breed ?? '—'}</td><td>${a.dob ? fmtDate(a.dob) : '—'}</td><td></td><td>${a.status ?? '—'}</td></tr>`
  ).join('')

  const calfRows = (calves_born as Array<{ tag_number: string; calf_sex?: string | null; dob?: string | null; birth_weight_lbs?: number | null; status?: string | null; disposition?: string | null }>).map(c =>
    `<tr><td>#${c.tag_number}</td><td>${c.calf_sex ?? '—'}</td><td>${fmtDate(c.dob)}</td><td>—</td><td>${c.birth_weight_lbs ? c.birth_weight_lbs + ' lbs' : '—'}</td><td>${c.disposition ?? c.status ?? 'active'}</td></tr>`
  ).join('')

  const departureRows = [
    ...(deaths as Array<{ tag_number: string; disposition_date?: string | null; cause_of_death?: string | null }>).map(d =>
      `<tr><td>#${d.tag_number}</td><td>${fmtDate(d.disposition_date)}</td><td>DECEASED</td><td>${d.cause_of_death ?? '—'}</td><td>—</td><td>—</td><td>—</td></tr>`
    ),
    ...(sales as Array<{ animal_id: string; sale_date: string; buyer?: string | null; destination?: string | null; gross_proceeds?: number | null }>).map(s =>
      `<tr><td>#${s.animal_id}</td><td>${fmtDate(s.sale_date)}</td><td>SOLD</td><td>${s.buyer ?? s.destination ?? '—'}</td><td>${fmtMoney(s.gross_proceeds)}</td><td>—</td><td>—</td></tr>`
    ),
  ].join('')

  const grazingRows = (invoices as Array<{ period_start?: string | null; period_end?: string | null; total_amount?: number | null }>).map(inv =>
    `<tr><td>${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}</td><td>—</td><td>—</td><td>${fmtMoney(inv.total_amount)}</td></tr>`
  ).join('')

  const grazingTotal = summary.grazing_fees
  const saleFees     = summary.sale_fees
  const netCalfProceeds = summary.net_proceeds
  const balanceDueToOp = settlement?.balance_due_to_operator ?? 0
  const balanceDueToOwner = settlement?.balance_due_to_owner ?? 0
  const balanceLabel = balanceDueToOp > 0 ? `Balance Due to Operator` : `Balance Due to Owner`
  const balanceAmount = balanceDueToOp > 0 ? balanceDueToOp : balanceDueToOwner

  const deathLossRow = settlement
    ? `<tr><td>${settlement.death_loss_responsibility === 'operator' ? 'Plus: Death loss (operator absorbs)' : 'Death loss'}</td><td style="text-align:right">${fmtMoney(settlement.operator_death_loss_share)}</td></tr>`
    : ''

  const transferRow = (transfers as Array<unknown>).length > 0
    ? `<tr><td>Less: Calf transfers (FMV)</td><td style="text-align:right">-${fmtMoney(settlement?.calf_transfers_fmv)}</td></tr>`
    : ''

  const carryForwardNote = settlement?.shortfall_carried_forward
    ? `<p style="margin-top:12px;font-size:12px;color:#666">Carry-forward shortfall: ${settlement.shortfall_carried_forward} calf(ves) to next year</p>`
    : ''

  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
  .ranch-name { font-size: 22px; font-weight: bold; }
  .report-title { font-size: 28px; color: #ea580c; font-weight: bold; }
  .owner-name { font-size: 16px; color: #555; }
  .section { margin-bottom: 30px; }
  .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #ea580c; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
  .summary-box { background: #f9fafb; border-radius: 8px; padding: 20px; margin-top: 20px; }
  .balance-line { font-size: 18px; font-weight: bold; color: #ea580c; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  .chip-success { background: #d1fae5; color: #065f46; }
  .chip-warning { background: #fef3c7; color: #92400e; }
  .chip-danger { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
<div class="header">
  <div><div class="ranch-name">${ranchName}</div><div class="owner-name">Custom Grazing Report</div></div>
  <div style="text-align:right"><div class="report-title">${year} ANNUAL REPORT</div><div class="owner-name">${ownerName}</div></div>
</div>

<div class="section">
  <div class="section-title">Current Herd as of Dec 31, ${year}</div>
  <table><tr><th>Tag</th><th>Sex</th><th>Breed</th><th>DOB</th><th>Location</th><th>Status</th></tr>${currentHerdRows}</table>
</div>

<div class="section">
  <div class="section-title">${year} Calf Crop</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
    <div><div style="font-size:11px;color:#666">BORN</div><div style="font-size:24px;font-weight:bold">${calves_born.length}</div></div>
    <div><div style="font-size:11px;color:#666">WEANED</div><div style="font-size:24px;font-weight:bold">${settlement?.calves_weaned ?? calves_born.length - deaths.length}</div></div>
    <div><div style="font-size:11px;color:#666">DEATH LOSS</div><div style="font-size:24px;font-weight:bold">${deathLossPct}% <span class="chip chip-${deathLossChip}">${deathLossLabel}</span></div></div>
  </div>
  <table><tr><th>Tag</th><th>Sex</th><th>DOB</th><th>Sire</th><th>Birth Wt</th><th>Disposition</th></tr>${calfRows}</table>
</div>

<div class="section">
  <div class="section-title">Departures &amp; Sales</div>
  <table><tr><th>Tag</th><th>Date</th><th>Disposition</th><th>Buyer/Venue</th><th>Gross</th><th>Fee</th><th>Net to You</th></tr>${departureRows}</table>
</div>

<div class="section">
  <div class="section-title">Grazing Fees</div>
  <table>
    <tr><th>Period</th><th>Head</th><th>Rate</th><th>Amount</th></tr>
    ${grazingRows}
    <tr><td colspan="3"><strong>Total Grazing</strong></td><td><strong>${fmtMoney(grazingTotal)}</strong></td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">Settlement Summary</div>
  <div class="summary-box">
    <table>
      <tr><td>Calf sale proceeds</td><td style="text-align:right">${fmtMoney(netCalfProceeds)}</td></tr>
      <tr><td>Less: Grazing fees</td><td style="text-align:right">-${fmtMoney(grazingTotal)}</td></tr>
      <tr><td>Less: Sale fees</td><td style="text-align:right">-${fmtMoney(saleFees)}</td></tr>
      ${deathLossRow}
      ${transferRow}
      <tr style="border-top:2px solid #111">
        <td class="balance-line">${balanceLabel}</td>
        <td style="text-align:right" class="balance-line">${fmtMoney(balanceAmount)}</td>
      </tr>
    </table>
    ${carryForwardNote}
  </div>
</div>

<p style="color:#999;font-size:11px;margin-top:40px;text-align:center">Generated by Brand Book — ${ranchName} · ${generatedDate}</p>
</body>
</html>`

  const pdfBuffer = await generatePDF(html)

  const pdfKey = `reports/grazing/${id}-${year}-annual.pdf`
  const pdfUrl = await uploadToR2(pdfKey, pdfBuffer, 'application/pdf')

  // Update settlement pdf_url if settlement exists
  if (settlement?.id) {
    await supabase
      .from('grazing_settlements')
      .update({ pdf_url: pdfUrl })
      .eq('id', settlement.id)
  }

  return NextResponse.json({ pdf_url: pdfUrl })
}
