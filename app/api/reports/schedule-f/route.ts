export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
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

  // ── Sales income: use owner_id snapshot (primary), fall back for legacy rows ──
  let line1 = 0   // purchased livestock resold
  let line2 = 0   // raised livestock sold
  let costBasis = 0

  // Primary: sales with owner_id snapshot set (new flow)
  const { data: snapshotSales } = await supabase
    .from('sales')
    .select('gross_proceeds, origin')
    .eq('owner_id', owner_id)
    .gte('sale_date', yearStart)
    .lte('sale_date', yearEnd)
    .not('owner_id', 'is', null)

  for (const s of snapshotSales ?? []) {
    const p = s.gross_proceeds ?? 0
    if (s.origin === 'purchased') line1 += p
    else line2 += p
  }

  // Fallback: legacy sales rows with no owner_id snapshot — join via current animal owner
  const { data: ownerAnimals } = await supabase
    .from('animals')
    .select('id, origin, purchase_price, ai_cost, semen_cost, embryo_cost, implant_fee')
    .eq('owner_id', owner_id)
  const animalIds = (ownerAnimals ?? []).map((a: any) => a.id)
  const animalMap = Object.fromEntries((ownerAnimals ?? []).map((a: any) => [a.id, a]))

  if (animalIds.length > 0) {
    const { data: legacySales } = await supabase
      .from('sales')
      .select('animal_id, gross_proceeds, origin')
      .in('animal_id', animalIds)
      .is('owner_id', null)
      .gte('sale_date', yearStart)
      .lte('sale_date', yearEnd)

    for (const s of legacySales ?? []) {
      const p = s.gross_proceeds ?? 0
      const origin = s.origin || animalMap[s.animal_id]?.origin
      if (origin === 'purchased') {
        line1     += p
        costBasis += animalMap[s.animal_id]?.purchase_price ?? 0
      } else {
        line2     += p
        const a = animalMap[s.animal_id]
        if (a) costBasis += (a.ai_cost ?? 0) + (a.semen_cost ?? 0) + (a.embryo_cost ?? 0) + (a.implant_fee ?? 0)
      }
    }
  }

  // ── Calf-share weaning memo ───────────────────────────────────────────────
  const calfShareMemoLines: string[] = []
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
