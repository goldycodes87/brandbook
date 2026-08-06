export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { searchParams } = new URL(req.url)
  const owner_id = searchParams.get('owner_id') ?? ''
  const year     = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  if (!owner_id) return NextResponse.json({ error: 'owner_id required' }, { status: 400 })

  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  // ── Owner ─────────────────────────────────────────────────────────────────
  const { data: owner } = await supabase
    .from('grazing_owners')
    .select('id, name, owner_name, company_name')
    .eq('id', owner_id)
    .single()

  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  // ── Owner's animals ───────────────────────────────────────────────────────
  const { data: ownerAnimals } = await supabase
    .from('animals')
    .select('id, origin, purchase_price, ai_cost, semen_cost, embryo_cost, implant_fee')
    .eq('owner_id', owner_id)

  const animalIds  = (ownerAnimals ?? []).map((a: any) => a.id)
  const animalMap  = Object.fromEntries((ownerAnimals ?? []).map((a: any) => [a.id, a]))

  // ── Sales → Line 1 (purchased resold) and Line 2 (raised sold) ───────────
  // TODO switch to sales.owner_id snapshot once the Sale flow adds it
  let line1 = 0
  let line2 = 0
  let costBasis = 0
  const calfShareMemoLines: string[] = []

  if (animalIds.length > 0) {
    const { data: sales } = await supabase
      .from('sales')
      .select('animal_id, gross_proceeds')
      .in('animal_id', animalIds)
      .gte('sale_date', yearStart)
      .lte('sale_date', yearEnd)

    for (const sale of sales ?? []) {
      const proceeds = sale.gross_proceeds ?? 0
      const animal   = animalMap[sale.animal_id]
      if (!animal) continue
      if (animal.origin === 'purchased') {
        line1     += proceeds
        costBasis += animal.purchase_price ?? 0
      } else {
        line2     += proceeds
        costBasis += (animal.ai_cost ?? 0) + (animal.semen_cost ?? 0) + (animal.embryo_cost ?? 0) + (animal.implant_fee ?? 0)
      }
    }
  }

  // ── Calf-share weaning memo ───────────────────────────────────────────────
  if (animalIds.length > 0) {
    const { data: weanings } = await supabase
      .from('reproduction_events')
      .select('animal_id, weaning_weight_lbs, calf_id')
      .in('animal_id', animalIds)
      .eq('event_type', 'weaned')
      .gte('event_date', yearStart)
      .lte('event_date', yearEnd)

    for (const w of weanings ?? []) {
      if (w.weaning_weight_lbs) {
        calfShareMemoLines.push(`${w.weaning_weight_lbs} lbs (calf ${w.calf_id ?? '?'})`)
      }
    }
  }

  // ── Expenses by schedule_f_line ───────────────────────────────────────────
  const { data: ownerExp } = await supabase
    .from('lease_expenses')
    .select('category_name, total_amount, category_id')
    .eq('owner_id', owner_id)
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
    const { data: cats } = await supabase
      .from('expense_categories')
      .select('id, schedule_f_line')
      .in('id', catIds)
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
      const u = unmapped.find(u => u.label === e.category_name)
      if (u) u.total += e.total_amount
      else unmapped.push({ label: e.category_name, total: e.total_amount })
    }
  }

  // ── Grazing → hardcode line 24b ───────────────────────────────────────────
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('owner_id', owner_id)
    .gte('period_start', yearStart)
    .lte('period_start', yearEnd)

  const grazingTotal = (invoices ?? []).reduce((s: number, inv: any) => s + (inv.total_amount ?? 0), 0)
  if (grazingTotal > 0) {
    if (grouped['24b']) grouped['24b'].total += grazingTotal
    else grouped['24b'] = { label: 'Rent/Lease — Grazing', total: grazingTotal }
  }

  const expenses = Object.entries(grouped)
    .map(([line, { label, total }]) => ({ line, label, total }))
    .sort((a, b) => parseFloat(a.line) - parseFloat(b.line))

  return NextResponse.json({
    owner: { id: owner.id, name: owner.company_name || owner.owner_name || owner.name },
    year,
    income: { line1, line2, costBasis, calfShareMemo: calfShareMemoLines.join('; ') || null },
    expenses,
    unmapped,
  })
}
