export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Fetch animal — verify ownership
  const { data: animal } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, breed, dob, status, origin, purchase_price, purchase_date, photos, dam_id, sire_id, owner_id, ai_cost, semen_cost, embryo_cost, implant_fee, manual_grazing_cost_override, weaning_date')
    .eq('id', id)
    .maybeSingle()

  if (!animal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (animal.owner_id !== session.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch dam and sire separately (NEVER nested animals join — PGRST201)
  const [damRes, sireRes] = await Promise.all([
    animal.dam_id
      ? supabase.from('animals').select('tag_number, name').eq('id', animal.dam_id).maybeSingle()
      : Promise.resolve({ data: null }),
    animal.sire_id
      ? supabase.from('animals').select('tag_number, name').eq('id', animal.sire_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Reproduction events
  const { data: reproEvents } = await supabase
    .from('reproduction_events')
    .select('id, event_type, event_date, conception_method, sire_name_text, expected_calving_date, preg_check_result, calving_ease_score, weaning_date, weaning_weight_lbs')
    .eq('animal_id', id)
    .order('event_date', { ascending: false })
    .limit(20)

  // Health events
  const { data: healthEvents } = await supabase
    .from('health_events')
    .select('id, event_type, event_date, drug_name, dose_amount, dose_unit, bcs_score, notes')
    .eq('animal_id', id)
    .order('event_date', { ascending: false })
    .limit(10)

  // Reminders
  const today = new Date().toISOString().split('T')[0]
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, reminder_type, title, due_date, is_dismissed')
    .eq('animal_id', id)
    .eq('is_dismissed', false)
    .gte('due_date', today)
    .order('due_date', { ascending: true })
    .limit(5)

  // Current lease
  const { data: currentLease } = await supabase
    .from('grazing_assignments')
    .select('start_date, lease_id')
    .eq('animal_id', id)
    .is('end_date', null)
    .limit(1)
    .maybeSingle()

  let currentPasture: { property_name: string; start_date: string } | null = null
  if (currentLease) {
    const { data: lease } = await supabase
      .from('leases')
      .select('property_name')
      .eq('id', currentLease.lease_id)
      .maybeSingle()
    if (lease) {
      currentPasture = { property_name: lease.property_name, start_date: currentLease.start_date }
    }
  }

  // ─── Cost basis (replicated from app/api/animals/[id]/cost-basis/route.ts) ──
  let baseCost = 0
  if (animal.origin === 'purchased' || !animal.origin) {
    baseCost = animal.purchase_price || 0
  } else {
    baseCost = (animal.ai_cost || 0) + (animal.semen_cost || 0) + (animal.embryo_cost || 0) + (animal.implant_fee || 0)
  }

  // Breeding costs from repro events
  const { data: bredEvents } = await supabase
    .from('reproduction_events')
    .select('ai_cost, straw_cost')
    .eq('animal_id', id)
    .eq('event_type', 'bred')

  const breedingCosts = (bredEvents ?? []).reduce(
    (sum: number, e: { ai_cost: number | null; straw_cost: number | null }) =>
      sum + (e.ai_cost || 0) + (e.straw_cost || 0),
    0,
  )

  // Grazing costs
  let grazingCosts = 0
  if (animal.sex === 'calf' && !animal.weaning_date) {
    grazingCosts = 0
  } else if (animal.manual_grazing_cost_override != null) {
    grazingCosts = animal.manual_grazing_cost_override
  } else {
    let externalOwnerRate: number | null = null
    if (animal.owner_id) {
      const { data: owner } = await supabase
        .from('grazing_owners')
        .select('is_self, billing_rate')
        .eq('id', animal.owner_id)
        .maybeSingle()
      if (owner && !owner.is_self && owner.billing_rate != null) {
        externalOwnerRate = Number(owner.billing_rate)
      }
    }

    const { data: assignments } = await supabase
      .from('grazing_assignments')
      .select('start_date, end_date, lease_id')
      .eq('animal_id', id)

    if (assignments && assignments.length > 0) {
      const leaseIds = [...new Set(assignments.map((a: { lease_id: string }) => a.lease_id))]
      const { data: leases } = await supabase
        .from('leases')
        .select('id, rate_per_head, rate_type, is_home_ranch')
        .in('id', leaseIds)

      const leaseMap = Object.fromEntries((leases ?? []).map((l: { id: string; rate_per_head: number | null; rate_type: string | null; is_home_ranch: boolean | null }) => [l.id, l]))

      grazingCosts = assignments.reduce((sum: number, a: { start_date: string; end_date: string | null; lease_id: string }) => {
        const lease = leaseMap[a.lease_id]
        if (!lease) return sum
        const start = new Date(a.start_date)
        const end = a.end_date ? new Date(a.end_date) : new Date()
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        const months = days / 30

        if (externalOwnerRate != null) {
          return sum + months * externalOwnerRate
        } else {
          if (lease.is_home_ranch) return sum
          if (!['per_head', 'per_head_month'].includes(lease.rate_type ?? '')) return sum
          return sum + months * (lease.rate_per_head || 0)
        }
      }, 0)
    }
  }

  // Animal-specific expenses
  const { data: animalExpenses } = await supabase
    .from('lease_expenses')
    .select('total_amount')
    .eq('animal_id', id)
    .eq('expense_type', 'animal_specific')

  const animalExpenseCosts = (animalExpenses ?? []).reduce(
    (sum: number, e: { total_amount: number | null }) => sum + (e.total_amount || 0),
    0,
  )

  const totalInvested = baseCost + breedingCosts + grazingCosts + animalExpenseCosts

  return NextResponse.json({
    animal: {
      id: animal.id,
      tag_number: animal.tag_number,
      name: animal.name,
      sex: animal.sex,
      breed: animal.breed,
      dob: animal.dob,
      status: animal.status,
      origin: animal.origin,
      purchase_price: animal.purchase_price,
      purchase_date: animal.purchase_date,
      photos: animal.photos ?? [],
      dam_id: animal.dam_id,
      sire_id: animal.sire_id,
    },
    dam: damRes.data ? { tag_number: damRes.data.tag_number, name: damRes.data.name } : null,
    sire: sireRes.data ? { tag_number: sireRes.data.tag_number, name: sireRes.data.name } : null,
    reproduction_events: reproEvents ?? [],
    health_events: healthEvents ?? [],
    reminders: reminders ?? [],
    current_pasture: currentPasture,
    cost_basis: {
      base_cost: baseCost,
      breeding_costs: breedingCosts,
      grazing_costs: grazingCosts,
      animal_expense_costs: animalExpenseCosts,
      total_invested: totalInvested,
      breakdown: {
        purchase_price: animal.purchase_price || 0,
        ai_semen_costs: (animal.ai_cost || 0) + (animal.semen_cost || 0) + breedingCosts,
        embryo_implant: (animal.embryo_cost || 0) + (animal.implant_fee || 0),
        grazing: grazingCosts,
        animal_expenses: animalExpenseCosts,
      },
    },
  })
}
