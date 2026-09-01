export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReportPdfBuffer, ReportSection } from '@/lib/generate-invoice-pdf'
import { uploadToR2 } from '@/lib/r2'

type ReportType = 'schedule_f' | 'pl' | 'grazing' | 'herd' | 'owner_summary'

function $$(n: number | null | undefined): string {
  return '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function nn(n: number | null | undefined): string {
  return String(n ?? 0)
}

function dd(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { type, owner_id, year: yearInput } = body as { type: ReportType; owner_id?: string; year?: number }
  const year      = yearInput ?? new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const validTypes: ReportType[] = ['schedule_f', 'pl', 'grazing', 'herd', 'owner_summary']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  }
  if (['schedule_f', 'pl', 'owner_summary'].includes(type) && !owner_id) {
    return NextResponse.json({ error: 'owner_id required for this report type' }, { status: 400 })
  }

  // Narrowed here rather than at each use: the guard above already refuses
  // these report types without an owner, but TypeScript cannot see through
  // an Array.includes to know it.
  const ownerId = owner_id as string

  let title = ''
  const sections: ReportSection[] = []

  try {
    // ── SCHEDULE F ────────────────────────────────────────────────────────────
    if (type === 'schedule_f') {
      const { data: owner } = await supabase
        .from('grazing_owners')
        .select('id, name, owner_name, company_name')
        .eq('id', ownerId)
        .single()

      const ownerName = owner?.company_name || owner?.owner_name || owner?.name || 'Owner'
      title = `Schedule F — ${ownerName} — ${year}`

      // Owner's animals
      const { data: ownerAnimals } = await supabase
        .from('animals')
        .select('id, origin, purchase_price, ai_cost, semen_cost, embryo_cost, implant_fee')
        .eq('owner_id', ownerId)
      const animalIds = (ownerAnimals ?? []).map((a: any) => a.id)
      const animalMap = Object.fromEntries((ownerAnimals ?? []).map((a: any) => [a.id, a]))

      // Sales
      let line1 = 0, line2 = 0, costBasis = 0
      if (animalIds.length > 0) {
        const { data: sales } = await supabase
          .from('sales')
          .select('animal_id, gross_proceeds')
          .in('animal_id', animalIds)
          .gte('sale_date', yearStart)
          .lte('sale_date', yearEnd)
        for (const s of sales ?? []) {
          const a = animalMap[s.animal_id]
          if (!a) continue
          const p = s.gross_proceeds ?? 0
          if (a.origin === 'purchased') { line1 += p; costBasis += a.purchase_price ?? 0 }
          else { line2 += p; costBasis += (a.ai_cost ?? 0) + (a.semen_cost ?? 0) + (a.embryo_cost ?? 0) + (a.implant_fee ?? 0) }
        }
      }

      // Calf-share memo
      let calfShareMemo: string | null = null
      if (animalIds.length > 0) {
        const { data: weanings } = await supabase
          .from('reproduction_events')
          .select('weaning_weight_lbs, calf_id')
          .in('animal_id', animalIds)
          .eq('event_type', 'weaned')
          .gte('event_date', yearStart)
          .lte('event_date', yearEnd)
        const lines = (weanings ?? [])
          .filter((w: any) => w.weaning_weight_lbs)
          .map((w: any) => `${w.weaning_weight_lbs} lbs (calf ${w.calf_id ?? '?'})`)
        if (lines.length > 0) calfShareMemo = lines.join('; ')
      }

      // Expenses by schedule_f_line
      const { data: ownerExp } = await supabase
        .from('lease_expenses')
        .select('category_name, total_amount, category_id')
        .eq('owner_id', ownerId)
        .gte('expense_date', yearStart)
        .lte('expense_date', yearEnd)
      let animalExp: any[] = []
      if (animalIds.length > 0) {
        const { data: ae } = await supabase
          .from('lease_expenses')
          .select('category_name, total_amount, category_id')
          .in('animal_id', animalIds)
          .gte('expense_date', yearStart)
          .lte('expense_date', yearEnd)
        animalExp = ae ?? []
      }
      const allExp = [...(ownerExp ?? []), ...animalExp]
      const catIds = [...new Set(allExp.map((e: any) => e.category_id).filter(Boolean))]
      let catMap: Record<string, string> = {}
      if (catIds.length > 0) {
        const { data: cats } = await supabase.from('expense_categories').select('id, schedule_f_line').in('id', catIds)
        catMap = Object.fromEntries((cats ?? []).map((c: any) => [c.id, c.schedule_f_line ?? '']))
      }
      const grouped: Record<string, { label: string; total: number }> = {}
      const unmapped: { label: string; total: number }[] = []
      for (const e of allExp) {
        const sfLine = e.category_id ? (catMap[e.category_id] ?? '') : ''
        if (sfLine) {
          if (!grouped[sfLine]) grouped[sfLine] = { label: e.category_name, total: 0 }
          grouped[sfLine].total += e.total_amount
        } else {
          const u = unmapped.find((u) => u.label === e.category_name)
          if (u) u.total += e.total_amount
          else unmapped.push({ label: e.category_name, total: e.total_amount })
        }
      }
      // Grazing → 24b
      const { data: invs } = await supabase
        .from('invoices').select('total_amount')
        .eq('owner_id', ownerId)
        .gte('period_start', yearStart).lte('period_start', yearEnd)
      const grazingTotal = (invs ?? []).reduce((s: number, inv: any) => s + (inv.total_amount ?? 0), 0)
      if (grazingTotal > 0) {
        if (grouped['24b']) grouped['24b'].total += grazingTotal
        else grouped['24b'] = { label: 'Rent/Lease — Grazing', total: grazingTotal }
      }
      const expenses = Object.entries(grouped)
        .map(([line, { label, total }]) => ({ line, label, total }))
        .sort((a, b) => parseFloat(a.line) - parseFloat(b.line))

      // Build sections
      const incomeRows: { label: string; value: string }[] = [
        { label: 'Line 1a — Livestock purchased for resale (gross proceeds)', value: $$(line1) },
        { label: 'Line 1b — Less: Cost basis of purchased livestock',         value: $$(costBasis > 0 && line1 > 0 ? costBasis : 0) },
        { label: 'Line 2   — Livestock raised for sale',                       value: $$(line2) },
        { label: 'Total farm income',                                           value: $$(line1 + line2) },
      ]
      if (calfShareMemo) incomeRows.push({ label: 'Calf-share memo', value: calfShareMemo })

      sections.push({ heading: 'Part I — Farm Income', rows: incomeRows })

      const totalExpenses = expenses.reduce((s, e) => s + e.total, 0)
      sections.push({
        heading: 'Part II — Farm Expenses',
        rows: [{ label: 'Total farm expenses', value: $$(totalExpenses) }],
        table: {
          columns: ['Line', 'Category', 'Amount'],
          rows: [
            ...expenses.map(e => [e.line, e.label, $$(e.total)]),
            ['', 'TOTAL', $$(totalExpenses)],
          ],
        },
      })

      if (unmapped.length > 0) {
        sections.push({
          heading: 'Unmapped Expenses — verify IRS line assignment',
          rows: unmapped.map(u => ({ label: u.label, value: $$(u.total) })),
        })
      }

      sections.push({
        heading: 'Net Farm Profit / Loss',
        rows: [
          { label: 'Total income',   value: $$(line1 + line2) },
          { label: 'Total expenses', value: $$(totalExpenses) },
          { label: 'Net farm profit / loss', value: $$(line1 + line2 - totalExpenses) },
        ],
      })
    }

    // ── P&L ──────────────────────────────────────────────────────────────────
    else if (type === 'pl') {
      const { data: owner } = await supabase
        .from('grazing_owners').select('id, name, owner_name, company_name')
        .eq('id', ownerId).single()
      const ownerName = owner?.company_name || owner?.owner_name || owner?.name || 'Owner'
      title = `Financial P&L — ${ownerName} — ${year}`

      const { data: ownerAnimals } = await supabase.from('animals').select('id').eq('owner_id', ownerId)
      const animalIds = (ownerAnimals ?? []).map((a: any) => a.id)

      let salesTotal = 0
      if (animalIds.length > 0) {
        const { data: sales } = await supabase.from('sales').select('gross_proceeds')
          .in('animal_id', animalIds).gte('sale_date', yearStart).lte('sale_date', yearEnd)
        salesTotal = (sales ?? []).reduce((s: number, x: any) => s + (x.gross_proceeds ?? 0), 0)
      }

      const { data: invs } = await supabase.from('invoices').select('total_amount, status')
        .eq('owner_id', ownerId).gte('period_start', yearStart).lte('period_start', yearEnd)
      const grazingBilled = (invs ?? []).reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
      const grazingPaid   = (invs ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)

      const { data: ownerExp } = await supabase.from('lease_expenses').select('category_name, total_amount')
        .eq('owner_id', ownerId).gte('expense_date', yearStart).lte('expense_date', yearEnd)
      let animalExp: any[] = []
      if (animalIds.length > 0) {
        const { data: ae } = await supabase.from('lease_expenses').select('category_name, total_amount')
          .in('animal_id', animalIds).gte('expense_date', yearStart).lte('expense_date', yearEnd)
        animalExp = ae ?? []
      }
      const directByCategory: Record<string, number> = {}
      for (const e of [...(ownerExp ?? []), ...animalExp]) {
        directByCategory[e.category_name] = (directByCategory[e.category_name] ?? 0) + e.total_amount
      }
      const directTotal   = Object.values(directByCategory).reduce((s, v) => s + v, 0)
      const totalExpenses = grazingBilled + directTotal

      sections.push({ heading: 'Income', rows: [
        { label: 'Cattle sales',  value: $$(salesTotal) },
        { label: 'Total income',  value: $$(salesTotal) },
      ]})

      const expenseRows: { label: string; value: string }[] = [
        { label: 'Grazing fees billed',  value: $$(grazingBilled) },
        { label: 'Grazing fees paid',    value: $$(grazingPaid) },
        { label: 'Grazing fees unpaid',  value: $$(grazingBilled - grazingPaid) },
        ...Object.entries(directByCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([label, total]) => ({ label, value: $$(total) })),
        { label: 'Total expenses',       value: $$(totalExpenses) },
      ]
      sections.push({ heading: 'Expenses', rows: expenseRows })
      sections.push({ heading: 'Net Profit / Loss', rows: [
        { label: 'Net P&L', value: $$(salesTotal - totalExpenses) },
      ]})
    }

    // ── GRAZING ───────────────────────────────────────────────────────────────
    else if (type === 'grazing') {
      title = `Grazing Billing Summary — ${year}`

      const { data: invs } = await supabase.from('invoices')
        .select('id, owner_id, total_amount, status')
        .gte('period_start', yearStart).lte('period_start', yearEnd)

      const ownerIds = [...new Set((invs ?? []).map((i: any) => i.owner_id).filter(Boolean))]
      let ownerNames: Record<string, string> = {}
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase.from('grazing_owners')
          .select('id, name, owner_name, company_name').in('id', ownerIds)
        ownerNames = Object.fromEntries((owners ?? []).map((o: any) => [o.id, o.company_name || o.owner_name || o.name]))
      }

      const byOwner: Record<string, { name: string; billed: number; paid: number; count: number }> = {}
      for (const inv of invs ?? []) {
        if (!inv.owner_id) continue
        if (!byOwner[inv.owner_id]) byOwner[inv.owner_id] = { name: ownerNames[inv.owner_id] ?? '?', billed: 0, paid: 0, count: 0 }
        byOwner[inv.owner_id].billed += inv.total_amount ?? 0
        byOwner[inv.owner_id].count  += 1
        if (inv.status === 'paid') byOwner[inv.owner_id].paid += inv.total_amount ?? 0
      }

      const rows = Object.values(byOwner).sort((a, b) => a.name.localeCompare(b.name))
      const grandTotal  = rows.reduce((s, r) => s + r.billed, 0)
      const grandPaid   = rows.reduce((s, r) => s + r.paid,   0)
      const grandUnpaid = grandTotal - grandPaid

      sections.push({ heading: `Grazing Billing — ${year}`, rows: [
        { label: 'Total billed',      value: $$(grandTotal) },
        { label: 'Total paid',        value: $$(grandPaid) },
        { label: 'Outstanding',       value: $$(grandUnpaid) },
        { label: 'Owners with invoices', value: nn(rows.length) },
      ]})

      sections.push({
        heading: 'Per-Owner Breakdown',
        rows: [],
        table: {
          columns: ['Owner', 'Invoices', 'Billed', 'Paid', 'Outstanding'],
          rows: [
            ...rows.map(r => [r.name, nn(r.count), $$(r.billed), $$(r.paid), $$(r.billed - r.paid)]),
            ['TOTAL', '', $$(grandTotal), $$(grandPaid), $$(grandUnpaid)],
          ],
        },
      })
    }

    // ── HERD ─────────────────────────────────────────────────────────────────
    else if (type === 'herd') {
      title = `Herd / Repro / Health Report — ${year}`

      const { data: allAnimals } = await supabase.from('animals').select('id, sex, status, owner_id, disposition_date')
      const active = (allAnimals ?? []).filter((a: any) => a.status === 'active')
      const bySex: Record<string, number> = {}
      for (const a of active) bySex[a.sex ?? 'unknown'] = (bySex[a.sex ?? 'unknown'] ?? 0) + 1
      const deaths = (allAnimals ?? []).filter((a: any) =>
        a.status === 'deceased' && a.disposition_date >= yearStart && a.disposition_date <= yearEnd,
      ).length

      const { data: sales } = await supabase.from('sales').select('gross_proceeds')
        .gte('sale_date', yearStart).lte('sale_date', yearEnd)
      const salesRevenue = (sales ?? []).reduce((s: number, x: any) => s + (x.gross_proceeds ?? 0), 0)

      const { data: repro } = await supabase.from('reproduction_events')
        .select('event_type, preg_check_result, weaning_weight_lbs, conception_method')
        .gte('event_date', yearStart).lte('event_date', yearEnd)
      const bred      = (repro ?? []).filter((e: any) => e.event_type === 'bred')
      const ai        = bred.filter((e: any) => e.conception_method === 'ai').length
      const nat       = bred.filter((e: any) => e.conception_method !== 'ai').length
      const calved    = (repro ?? []).filter((e: any) => e.event_type === 'calved').length
      const pc        = (repro ?? []).filter((e: any) => e.event_type === 'preg_check')
      const confirmed = pc.filter((e: any) => e.preg_check_result === 'confirmed').length
      const open      = pc.filter((e: any) => e.preg_check_result === 'open').length
      const recheck   = pc.filter((e: any) => e.preg_check_result === 'recheck').length
      const weanArr   = (repro ?? []).filter((e: any) => e.event_type === 'weaned' && e.weaning_weight_lbs != null)
      const avgWean   = weanArr.length > 0
        ? Math.round(weanArr.reduce((s: number, e: any) => s + e.weaning_weight_lbs, 0) / weanArr.length)
        : null

      const { data: health } = await supabase.from('health_events').select('event_type')
        .gte('event_date', yearStart).lte('event_date', yearEnd)
      const healthByType: Record<string, number> = {}
      for (const h of health ?? []) {
        const t = h.event_type ?? 'unknown'
        healthByType[t] = (healthByType[t] ?? 0) + 1
      }

      sections.push({ heading: 'Active Herd', rows: [
        { label: 'Total active', value: nn(active.length) },
        ...Object.entries(bySex).sort().map(([sex, count]) => ({ label: sex.charAt(0).toUpperCase() + sex.slice(1), value: nn(count) })),
        { label: 'Owned by lessors', value: nn(active.filter((a: any) => a.owner_id != null).length) },
        { label: 'Ranch-owned',      value: nn(active.filter((a: any) => a.owner_id == null).length) },
        { label: `Deaths in ${year}`, value: nn(deaths) },
      ]})

      sections.push({ heading: `Sales — ${year}`, rows: [
        { label: 'Animals sold', value: nn((sales ?? []).length) },
        { label: 'Gross revenue', value: $$(salesRevenue) },
      ]})

      sections.push({ heading: `Reproduction — ${year}`, rows: [
        { label: 'Total breedings',    value: nn(bred.length) },
        { label: 'AI breedings',       value: nn(ai) },
        { label: 'Natural service',    value: nn(nat) },
        { label: 'Calved',             value: nn(calved) },
        { label: 'Preg checks total',  value: nn(pc.length) },
        { label: '  Confirmed',        value: nn(confirmed) },
        { label: '  Open',             value: nn(open) },
        { label: '  Recheck',          value: nn(recheck) },
        { label: 'Weanings recorded',  value: nn(weanArr.length) },
        { label: 'Avg weaning weight', value: avgWean != null ? `${avgWean} lbs` : '—' },
      ]})

      if (Object.keys(healthByType).length > 0) {
        sections.push({ heading: `Health Events — ${year}`, rows:
          Object.entries(healthByType).sort().map(([t, n]) => ({ label: t, value: nn(n) })),
        })
      }
    }

    // ── OWNER SUMMARY ─────────────────────────────────────────────────────────
    else if (type === 'owner_summary') {
      const { data: owner } = await supabase.from('grazing_owners')
        .select('id, name, owner_name, company_name, email, phone')
        .eq('id', ownerId).single()
      const ownerName = owner?.company_name || owner?.owner_name || owner?.name || 'Owner'
      title = `Owner Annual Summary — ${ownerName} — ${year}`

      // Current herd
      const { data: herd } = await supabase.from('animals')
        .select('id, tag_number, sex, breed, dob, status')
        .eq('owner_id', ownerId).eq('status', 'active').order('tag_number')

      // Calves born — need dam_ids first (separate query, no self-join)
      const { data: damRows } = await supabase.from('animals').select('id')
        .eq('owner_id', ownerId).in('sex', ['cow', 'heifer'])
      const damIds = (damRows ?? []).map((r: any) => r.id)
      let calvesBorn: any[] = []
      if (damIds.length > 0) {
        const { data: calves } = await supabase.from('animals')
          .select('id, tag_number, calf_sex, dob, birth_weight_lbs, status, disposition, disposition_date')
          .in('dam_id', damIds).gte('dob', yearStart).lte('dob', yearEnd).order('dob')
        calvesBorn = calves ?? []
      }

      // Deaths
      const { data: deaths } = await supabase.from('animals')
        .select('tag_number, disposition_date')
        .eq('owner_id', ownerId).eq('status', 'deceased')
        .gte('disposition_date', yearStart).lte('disposition_date', yearEnd)

      // Sales through owner's animal IDs
      const { data: ownerAnimalRows } = await supabase.from('animals').select('id').eq('owner_id', ownerId)
      const ownerAnimalIds = (ownerAnimalRows ?? []).map((a: any) => a.id)
      let sales: any[] = []
      if (ownerAnimalIds.length > 0) {
        const { data: s } = await supabase.from('sales')
          .select('animal_id, sale_date, buyer, gross_proceeds')
          .in('animal_id', ownerAnimalIds)
          .gte('sale_date', yearStart).lte('sale_date', yearEnd)
        sales = s ?? []
      }

      // Invoices
      const { data: invs } = await supabase.from('invoices')
        .select('invoice_number, period_start, period_end, total_amount, status')
        .eq('owner_id', ownerId)
        .gte('period_start', yearStart).lte('period_start', yearEnd)
        .order('period_start', { ascending: false })

      const grossSales   = sales.reduce((s, x) => s + (x.gross_proceeds ?? 0), 0)
      const grazingFees  = (invs ?? []).reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
      const deathCount   = (deaths ?? []).length
      const calfCount    = calvesBorn.length
      const deathLossPct = calfCount > 0 ? Math.round(deathCount / calfCount * 1000) / 10 : 0

      sections.push({ heading: 'Owner Overview', rows: [
        { label: 'Owner',         value: ownerName },
        { label: 'Year',          value: String(year) },
        { label: 'Contact',       value: [owner?.email, owner?.phone].filter(Boolean).join(' · ') || '—' },
        { label: 'Active herd',   value: `${(herd ?? []).length} head` },
        { label: 'Calves born',   value: nn(calfCount) },
        { label: 'Deaths',        value: nn(deathCount) },
        { label: 'Death loss',    value: `${deathLossPct}%` },
      ]})

      sections.push({ heading: `Sales — ${year}`, rows: [
        { label: 'Animals sold',   value: nn(sales.length) },
        { label: 'Gross proceeds', value: $$(grossSales) },
      ]})

      sections.push({ heading: `Grazing Fees — ${year}`, rows: [
        { label: 'Total billed', value: $$(grazingFees) },
        { label: 'Net to owner', value: $$(grossSales - grazingFees) },
      ]})

      if ((herd ?? []).length > 0) {
        sections.push({
          heading: 'Current Herd',
          rows: [],
          table: {
            columns: ['Tag', 'Sex', 'Breed', 'DOB'],
            rows: (herd ?? []).map((a: any) => [
              `#${a.tag_number}`,
              a.sex ?? '—',
              a.breed ?? '—',
              a.dob ? dd(a.dob) : '—',
            ]),
          },
        })
      }

      if ((invs ?? []).length > 0) {
        sections.push({
          heading: `Invoices — ${year}`,
          rows: [],
          table: {
            columns: ['Period', 'Inv #', 'Amount', 'Status'],
            rows: (invs ?? []).map((i: any) => [
              `${dd(i.period_start)} – ${dd(i.period_end)}`,
              i.invoice_number ?? '—',
              $$(i.total_amount),
              (i.status ?? '—').toUpperCase(),
            ]),
          },
        })
      }
    }

    const pdfBuffer = await generateReportPdfBuffer(title, sections)
    const pdfKey = `reports/${type}/${ownerId ?? 'ranch'}-${year}.pdf`
    const pdfUrl = await uploadToR2(pdfKey, pdfBuffer, 'application/pdf')

    return NextResponse.json({ pdf_url: pdfUrl })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[reports/generate]', err)
    return NextResponse.json({ error: err.message ?? 'Generation failed' }, { status: 500 })
  }
}
