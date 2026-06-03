export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // Calves of this dam (separate query — never nest animals)
  const { data: calves } = await supabase
    .from('animals')
    .select('id, tag_number')
    .eq('dam_id', id)

  const calfIds = (calves ?? []).map(c => c.id)

  // Sales of those calves
  let grossCalfRevenue = 0
  if (calfIds.length > 0) {
    const { data: calfSales } = await supabase
      .from('sales')
      .select('gross_proceeds, destination, animal_id')
      .in('animal_id', calfIds)
    grossCalfRevenue = (calfSales ?? []).reduce((sum, s) => sum + (s.gross_proceeds || 0), 0)
  }

  // Calf transfers FMV
  let transferRevenue = 0
  if (calfIds.length > 0) {
    const { data: transfers } = await supabase
      .from('calf_transfers')
      .select('fmv_at_transfer')
      .in('animal_id', calfIds)
    transferRevenue = (transfers ?? []).reduce((sum, t) => sum + (t.fmv_at_transfer || 0), 0)
  }

  const embryoRevenue = 0 // scaffold
  const grossRevenue = grossCalfRevenue + transferRevenue + embryoRevenue

  // Inline cost basis (avoid internal fetch)
  const { data: animal } = await supabase
    .from('animals')
    .select('origin, purchase_price, ai_cost, semen_cost, embryo_cost, implant_fee, manual_grazing_cost_override')
    .eq('id', id)
    .maybeSingle()

  let baseCost = 0
  if (animal) {
    if (animal.origin === 'purchased' || !animal.origin) {
      baseCost = animal.purchase_price || 0
    } else {
      baseCost = (animal.ai_cost || 0) + (animal.semen_cost || 0) + (animal.embryo_cost || 0) + (animal.implant_fee || 0)
    }
  }

  let grazingCosts = 0
  if (animal?.manual_grazing_cost_override != null) {
    grazingCosts = animal.manual_grazing_cost_override
  } else {
    const { data: assignments } = await supabase
      .from('grazing_assignments')
      .select('start_date, end_date, lease_id')
      .eq('animal_id', id)
    if (assignments && assignments.length > 0) {
      const leaseIds = [...new Set(assignments.map(a => a.lease_id))]
      const { data: leases } = await supabase.from('leases').select('id, rate_per_head, rate_type').in('id', leaseIds)
      const leaseMap = Object.fromEntries((leases ?? []).map(l => [l.id, l]))
      grazingCosts = assignments.reduce((sum, a) => {
        const lease = leaseMap[a.lease_id]
        if (!lease || lease.rate_type !== 'per_head') return sum
        const start = new Date(a.start_date)
        const end = a.end_date ? new Date(a.end_date) : new Date()
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        return sum + (days / 30) * (lease.rate_per_head || 0)
      }, 0)
    }
  }

  const totalInvested = baseCost + grazingCosts
  const netRevenue = grossRevenue - totalInvested

  return NextResponse.json({
    gross_revenue: grossRevenue,
    net_revenue: netRevenue,
    total_invested: totalInvested,
    breakdown: {
      calf_sales: grossCalfRevenue,
      calf_transfers: transferRevenue,
      embryo_sales: embryoRevenue,
    },
    cost_breakdown: {
      purchase_price: animal?.purchase_price || 0,
      ai_cost: animal?.ai_cost || 0,
      semen_cost: animal?.semen_cost || 0,
      embryo_cost: animal?.embryo_cost || 0,
      implant_fee: animal?.implant_fee || 0,
      vet_bills: 0,
      grazing: grazingCosts,
    },
    calf_count: calves?.length || 0,
  })
}
