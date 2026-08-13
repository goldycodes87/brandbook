export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: animal } = await supabase
    .from('animals')
    .select('id, origin, sex, weaning_date, purchase_price, ai_cost, semen_cost, embryo_cost, implant_fee, manual_grazing_cost_override')
    .eq('id', id)
    .maybeSingle()

  if (!animal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Base cost
  let baseCost = 0
  if (animal.origin === 'purchased' || !animal.origin) {
    baseCost = animal.purchase_price || 0
  } else {
    baseCost = (animal.ai_cost || 0) + (animal.semen_cost || 0) + (animal.embryo_cost || 0) + (animal.implant_fee || 0)
  }

  // Vet costs — health_events has no drug_cost column yet (scaffold)
  const vetCosts = 0

  // Breeding costs — sum ai_cost + straw_cost from actual breeding events (all animals)
  const { data: bredEvents } = await supabase
    .from('reproduction_events')
    .select('ai_cost, straw_cost')
    .eq('animal_id', id)
    .eq('event_type', 'bred')

  const breedingCosts = (bredEvents ?? []).reduce(
    (sum, e) => sum + (e.ai_cost || 0) + (e.straw_cost || 0),
    0,
  )

  // Grazing costs — unweaned calves ride with dam and are not billed separately
  let grazingCosts = 0
  if (animal.sex === 'calf' && !animal.weaning_date) {
    grazingCosts = 0
  } else if (animal.manual_grazing_cost_override != null) {
    grazingCosts = animal.manual_grazing_cost_override
  } else {
    // Fetch assignments with lease rate data
    const { data: assignments } = await supabase
      .from('grazing_assignments')
      .select('start_date, end_date, lease_id')
      .eq('animal_id', id)

    if (assignments && assignments.length > 0) {
      // Fetch leases separately (no nested join needed here since grazing_assignments isn't animals)
      const leaseIds = [...new Set(assignments.map(a => a.lease_id))]
      const { data: leases } = await supabase
        .from('leases')
        .select('id, rate_per_head, rate_type')
        .in('id', leaseIds)

      const leaseMap = Object.fromEntries((leases ?? []).map(l => [l.id, l]))

      grazingCosts = assignments.reduce((sum, a) => {
        const lease = leaseMap[a.lease_id]
        if (!lease || lease.rate_type !== 'per_head') return sum
        const start = new Date(a.start_date)
        const end = a.end_date ? new Date(a.end_date) : new Date()
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        const months = days / 30
        return sum + months * (lease.rate_per_head || 0)
      }, 0)
    }
  }

  // Animal-specific expenses logged against this animal
  const { data: animalExpenses } = await supabase
    .from('lease_expenses')
    .select('total_amount')
    .eq('animal_id', id)
    .eq('expense_type', 'animal_specific')

  const animalExpenseCosts = (animalExpenses ?? []).reduce(
    (sum, e) => sum + (e.total_amount || 0),
    0,
  )

  // AI/semen = origin cost (stored on animal) + ongoing breeding costs (from repro events).
  // Kept separate in the API so callers can see both parts, but displayed as one line.
  const aiSemenOrigin  = (animal.ai_cost || 0) + (animal.semen_cost || 0)
  const embryoImplant  = (animal.embryo_cost || 0) + (animal.implant_fee || 0)

  const totalInvested = baseCost + vetCosts + breedingCosts + grazingCosts + animalExpenseCosts

  return NextResponse.json({
    base_cost: baseCost,
    vet_costs: vetCosts,
    grazing_costs: grazingCosts,
    animal_expense_costs: animalExpenseCosts,
    total_invested: totalInvested,
    manual_override: animal.manual_grazing_cost_override != null,
    breakdown: {
      purchase_price:    animal.purchase_price || 0,
      ai_semen_costs:    aiSemenOrigin + breedingCosts,
      embryo_implant:    embryoImplant,
      vet_bills:         vetCosts,
      grazing:           grazingCosts,
      animal_expenses:   animalExpenseCosts,
    },
  })
}
