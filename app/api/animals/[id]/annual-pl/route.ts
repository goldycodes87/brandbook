export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

/** Days of [aStart, aEnd] that fall inside [bStart, bEnd]. */
function overlapDays(aStart: string, aEnd: string | null, bStart: string, bEnd: string): number {
  const s = new Date((aStart > bStart ? aStart : bStart) + 'T00:00:00')
  const rawEnd = aEnd && aEnd < bEnd ? aEnd : bEnd
  const e = new Date(rawEnd + 'T00:00:00')
  const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1
  return days > 0 ? days : 0
}

// GET /api/animals/[id]/annual-pl?year=2026
//
// One year of operating cost vs revenue for a single animal.
//
// Deliberate accounting decisions, agreed with the operator:
//  - Purchase price is CAPITAL and excluded. Including it would show a huge
//    artificial loss in the year a cow was bought and inflate every later year.
//    It stays in lifetime cost basis, which this endpoint does not replace.
//  - A cow's revenue is her calves' sale proceeds in that year. Her calves'
//    own costs are NOT charged to her — each calf carries its own costs — so
//    nothing is counted twice across the two views.
//  - Unweaned calves accrue no grazing (they ride with the dam), matching
//    cost-basis and the billing rules.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const yearParam = req.nextUrl.searchParams.get('year')
  const year      = yearParam ? Number(yearParam) : new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const { data: animal } = await supabase
    .from('animals')
    .select('id, sex, weaning_date, manual_grazing_cost_override')
    .eq('id', id)
    .maybeSingle()

  if (!animal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── Breeding costs incurred this year ──────────────────────────────────────
  const { data: bredEvents } = await supabase
    .from('reproduction_events')
    .select('ai_cost, straw_cost')
    .eq('animal_id', id)
    .eq('event_type', 'bred')
    .gte('event_date', yearStart)
    .lte('event_date', yearEnd)

  const breedingCosts = (bredEvents ?? []).reduce(
    (s, e) => s + (e.ai_cost || 0) + (e.straw_cost || 0), 0,
  )

  // ── Direct expenses dated in this year ─────────────────────────────────────
  const { data: animalExpenses } = await supabase
    .from('lease_expenses')
    .select('total_amount, category_name')
    .eq('animal_id', id)
    .gte('expense_date', yearStart)
    .lte('expense_date', yearEnd)

  const expenseCosts = (animalExpenses ?? []).reduce((s, e) => s + (e.total_amount || 0), 0)

  // ── Grazing accrued during this year ───────────────────────────────────────
  // Unweaned calves ride with the dam and accrue nothing. The manual override
  // is a lifetime figure, so it is not applied to a single year.
  let grazingCosts = 0
  if (!(animal.sex === 'calf' && !animal.weaning_date)) {
    const { data: assignments } = await supabase
      .from('grazing_assignments')
      .select('start_date, end_date, lease_id')
      .eq('animal_id', id)

    if (assignments && assignments.length > 0) {
      const leaseIds = [...new Set(assignments.map(a => a.lease_id))]
      const { data: leases } = await supabase
        .from('leases')
        .select('id, rate_per_head, rate_type')
        .in('id', leaseIds)

      const leaseMap = Object.fromEntries((leases ?? []).map(l => [l.id, l]))

      grazingCosts = assignments.reduce((sum, a) => {
        const lease = leaseMap[a.lease_id]
        if (!lease || lease.rate_type !== 'per_head') return sum
        const days = overlapDays(a.start_date, a.end_date, yearStart, yearEnd)
        if (days <= 0) return sum
        return sum + (days / 30) * (lease.rate_per_head || 0)
      }, 0)
    }
  }

  // ── Revenue: this animal's calves sold during the year ─────────────────────
  const { data: calves } = await supabase
    .from('animals')
    .select('id, tag_number')
    .eq('dam_id', id)

  const calfIds = (calves ?? []).map(c => c.id)
  let calfRevenue = 0
  let calvesSold  = 0

  if (calfIds.length > 0) {
    const { data: calfSales } = await supabase
      .from('sales')
      .select('gross_proceeds, animal_id, sale_date')
      .in('animal_id', calfIds)
      .gte('sale_date', yearStart)
      .lte('sale_date', yearEnd)

    calvesSold  = (calfSales ?? []).length
    calfRevenue = (calfSales ?? []).reduce((s, x) => s + (x.gross_proceeds || 0), 0)
  }

  // Her own sale, if she was sold this year
  const { data: ownSale } = await supabase
    .from('sales')
    .select('gross_proceeds')
    .eq('animal_id', id)
    .gte('sale_date', yearStart)
    .lte('sale_date', yearEnd)

  const ownSaleRevenue = (ownSale ?? []).reduce((s, x) => s + (x.gross_proceeds || 0), 0)

  const round = (n: number) => Math.round(n * 100) / 100
  const totalCosts   = round(breedingCosts + expenseCosts + grazingCosts)
  const totalRevenue = round(calfRevenue + ownSaleRevenue)

  return NextResponse.json({
    year,
    costs: {
      breeding:        round(breedingCosts),
      direct_expenses: round(expenseCosts),
      grazing:         round(grazingCosts),
      total:           totalCosts,
    },
    revenue: {
      calf_sales: round(calfRevenue),
      own_sale:   round(ownSaleRevenue),
      total:      totalRevenue,
    },
    net:          round(totalRevenue - totalCosts),
    calves_sold:  calvesSold,
    note: 'Operating costs only — purchase price is treated as capital and excluded. Calves carry their own costs separately.',
  })
}
