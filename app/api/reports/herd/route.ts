export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  // All active animals snapshot
  const { data: allAnimals, error: anErr } = await supabase
    .from('animals')
    .select('id, sex, status, origin, owner_id, dob, disposition_date')

  if (anErr) return NextResponse.json({ error: anErr.message }, { status: 500 })

  const active   = (allAnimals ?? []).filter((a: any) => a.status === 'active')
  const bySex    = active.reduce((acc: Record<string, number>, a: any) => {
    const s = a.sex ?? 'unknown'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const owned    = active.filter((a: any) => a.owner_id != null).length
  const unowned  = active.filter((a: any) => a.owner_id == null).length

  // Deaths disposed in the year
  const deaths = (allAnimals ?? []).filter((a: any) =>
    a.status === 'deceased' &&
    a.disposition_date >= yearStart &&
    a.disposition_date <= yearEnd,
  ).length

  // Sales in the year
  const { data: sales } = await supabase
    .from('sales')
    .select('id, gross_proceeds')
    .gte('sale_date', yearStart)
    .lte('sale_date', yearEnd)
  const salesCount    = (sales ?? []).length
  const salesRevenue  = (sales ?? []).reduce((s: number, sale: any) => s + (sale.gross_proceeds ?? 0), 0)

  // Reproduction events for the year
  const { data: reproEvents } = await supabase
    .from('reproduction_events')
    .select('event_type, preg_check_result, weaning_weight_lbs, conception_method')
    .gte('event_date', yearStart)
    .lte('event_date', yearEnd)

  const bredCount     = (reproEvents ?? []).filter((e: any) => e.event_type === 'bred').length
  const aiCount       = (reproEvents ?? []).filter((e: any) => e.event_type === 'bred' && e.conception_method === 'ai').length
  const naturalCount  = (reproEvents ?? []).filter((e: any) => e.event_type === 'bred' && e.conception_method !== 'ai').length
  const calvedCount   = (reproEvents ?? []).filter((e: any) => e.event_type === 'calved').length
  const pregChecks    = (reproEvents ?? []).filter((e: any) => e.event_type === 'preg_check')
  const confirmed     = pregChecks.filter((e: any) => e.preg_check_result === 'confirmed').length
  const open          = pregChecks.filter((e: any) => e.preg_check_result === 'open').length
  const recheck       = pregChecks.filter((e: any) => e.preg_check_result === 'recheck').length
  const weanings      = (reproEvents ?? []).filter((e: any) => e.event_type === 'weaned' && e.weaning_weight_lbs != null)
  const avgWeanWt     = weanings.length > 0
    ? weanings.reduce((s: number, e: any) => s + e.weaning_weight_lbs, 0) / weanings.length
    : null

  // Health events for the year
  const { data: healthEvents } = await supabase
    .from('health_events')
    .select('event_type')
    .gte('event_date', yearStart)
    .lte('event_date', yearEnd)

  const healthByType: Record<string, number> = {}
  for (const h of healthEvents ?? []) {
    const t = h.event_type ?? 'unknown'
    healthByType[t] = (healthByType[t] ?? 0) + 1
  }

  return NextResponse.json({
    year,
    herd: {
      activeTotal: active.length,
      bySex,
      owned,
      unowned,
      deaths,
    },
    sales: {
      count:   salesCount,
      revenue: salesRevenue,
    },
    repro: {
      bred:        bredCount,
      ai:          aiCount,
      natural:     naturalCount,
      calved:      calvedCount,
      pregChecks:  { confirmed, open, recheck, total: pregChecks.length },
      weanings:    weanings.length,
      avgWeanWt:   avgWeanWt != null ? Math.round(avgWeanWt) : null,
    },
    health: healthByType,
  })
}
