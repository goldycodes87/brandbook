export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calcOverlapDays,
  calcAnimalCost,
  calcPeriodLevelCost,
  getRateLabel,
} from '@/lib/lease-calculations'

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  // ── 1. Fetch lease + periods + all assignments in parallel ──────────────────
  const [leaseRes, periodsRes, assignRes] = await Promise.all([
    supabase.from('leases').select('*').eq('id', id).maybeSingle(),
    supabase.from('grazing_periods').select('*').eq('lease_id', id).order('start_date', { ascending: true }),
    supabase.from('grazing_assignments').select('animal_id, start_date, end_date').eq('lease_id', id),
  ])

  if (leaseRes.error)    return NextResponse.json({ error: leaseRes.error.message }, { status: 500 })
  if (!leaseRes.data)    return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
  if (periodsRes.error)  return NextResponse.json({ error: periodsRes.error.message }, { status: 500 })
  if (assignRes.error)   return NextResponse.json({ error: assignRes.error.message }, { status: 500 })

  const lease   = leaseRes.data   as Record<string, unknown>
  const periods = (periodsRes.data ?? []) as Record<string, unknown>[]
  const allAssignments = (assignRes.data ?? []) as Array<{
    animal_id: string; start_date: string; end_date: string | null
  }>

  const isHomeRanch  = Boolean(lease.is_home_ranch)
  const rateType     = lease.rate_type as string | null
  const ratePerHead  = Number(lease.rate_per_head) || 0
  const ratePerAcre  = Number(lease.rate_per_acre) || 0
  const ratePerAum   = Number(lease.rate_per_aum)  || 0
  const flatRate     = Number(lease.flat_rate)      || 0
  const acreage      = Number(lease.acreage)        || 0

  // ── 2. Fetch all unique animals referenced by any assignment ────────────────
  const allAnimalIds = [...new Set(allAssignments.map(a => a.animal_id))]

  type AnimalRow = {
    id: string; sex: string | null; weaning_date: string | null
    dam_id: string | null; owner_id: string | null
  }
  let animalMap = new Map<string, AnimalRow>()

  if (allAnimalIds.length > 0) {
    const { data: animals } = await supabase
      .from('animals')
      .select('id, sex, weaning_date, dam_id, owner_id')
      .in('id', allAnimalIds)
    for (const a of (animals ?? []) as AnimalRow[]) animalMap.set(a.id, a)
  }

  // ── 3. Fetch owner names ─────────────────────────────────────────────────────
  const ownerIds = [...new Set(
    [...animalMap.values()].map(a => a.owner_id).filter(Boolean) as string[]
  )]
  const ownerNameMap: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('grazing_owners')
      .select('id, name, company_name, owner_name')
      .in('id', ownerIds)
    for (const o of (owners ?? []) as Array<{ id: string; name: string; company_name: string | null; owner_name: string | null }>) {
      ownerNameMap[o.id] = o.company_name || o.owner_name || o.name || 'Unknown'
    }
  }

  const { data: ranchData } = await supabase
    .from('ranch_settings').select('ranch_name').limit(1).maybeSingle()
  const ranchName = (ranchData as { ranch_name?: string | null } | null)?.ranch_name?.trim() || 'My Ranch'

  function ownerLabel(ownerId: string | null): string {
    if (!ownerId) return ranchName
    return ownerNameMap[ownerId] ?? ranchName
  }

  // ── 4. Build per-period data ──────────────────────────────────────────────────
  const periodsWithCosts = periods.map(p => {
    const pStart = p.start_date as string
    const pEnd   = p.end_date   as string
    const pDays  = daysBetween(pStart, pEnd)

    // Assignments active during this period
    const activeAssignments = allAssignments.filter(a =>
      calcOverlapDays(a.start_date, a.end_date, pStart, pEnd) > 0
    )

    const activeAnimalIds = new Set(activeAssignments.map(a => a.animal_id))

    // Identify pair calves: unweaned calf whose dam is also active in this period
    const pairCalfIds = new Set<string>()
    for (const aid of activeAnimalIds) {
      const animal = animalMap.get(aid)
      if (!animal) continue
      if (
        animal.sex?.toLowerCase() === 'calf' &&
        !animal.weaning_date &&
        animal.dam_id &&
        activeAnimalIds.has(animal.dam_id)
      ) {
        pairCalfIds.add(aid)
      }
    }

    // Per-animal cost contributions
    type OwnerShare = {
      owner_id: string | null; owner_name: string
      animal_count: number; animal_days: number; cost: number; pair_calves_excluded: number
    }
    const ownerShares = new Map<string, OwnerShare>()

    const getOrCreate = (ownerId: string | null): OwnerShare => {
      const key = ownerId ?? '__ranch__'
      if (!ownerShares.has(key)) {
        ownerShares.set(key, {
          owner_id: ownerId, owner_name: ownerLabel(ownerId),
          animal_count: 0, animal_days: 0, cost: 0, pair_calves_excluded: 0,
        })
      }
      return ownerShares.get(key)!
    }

    let totalBillableAnimalDays = 0
    let pairCalvesExcluded = 0

    for (const assign of activeAssignments) {
      const animal = animalMap.get(assign.animal_id)
      if (!animal) continue

      const share = getOrCreate(animal.owner_id)

      if (pairCalfIds.has(assign.animal_id)) {
        share.pair_calves_excluded++
        pairCalvesExcluded++
        continue
      }

      const overlapDays = calcOverlapDays(assign.start_date, assign.end_date, pStart, pEnd)

      // Home ranch: ranch-owned animals tracked but not billed
      const isBillable = !isHomeRanch || animal.owner_id !== null

      share.animal_count++
      share.animal_days += overlapDays

      if (isBillable) {
        totalBillableAnimalDays += overlapDays

        const rate = rateType === 'per_head_day' ? ratePerHead
                   : rateType === 'per_head' || rateType === 'per_head_month' ? ratePerHead
                   : rateType === 'per_aum'  ? ratePerAum
                   : 0
        share.cost += calcAnimalCost(overlapDays, animal.sex, rateType, rate)
      }
    }

    // For per_acre / flat: period-level cost split proportionally by animal-days
    const periodLevelCost = calcPeriodLevelCost(
      pDays,
      rateType,
      rateType === 'per_acre' ? ratePerAcre : flatRate,
      acreage,
    )

    if (periodLevelCost > 0 && totalBillableAnimalDays > 0) {
      for (const share of ownerShares.values()) {
        // only distribute to billable owners
        const isBillableOwner = !isHomeRanch || share.owner_id !== null
        if (isBillableOwner) {
          share.cost += periodLevelCost * (share.animal_days / totalBillableAnimalDays)
        }
      }
    } else if (periodLevelCost > 0 && totalBillableAnimalDays === 0) {
      // No tracked animals — put cost under ranch owner
      const share = getOrCreate(null)
      share.cost += periodLevelCost
    }

    // Total cost for this period
    let calculatedCost = 0
    for (const share of ownerShares.values()) {
      const isBillable = !isHomeRanch || share.owner_id !== null
      if (isBillable) calculatedCost += share.cost
    }

    // Fall back to head_count if no assignment data (legacy periods)
    if (activeAssignments.length === 0 && (p.head_count as number) > 0) {
      const headCount = p.head_count as number
      const rate = rateType === 'per_head_day' ? ratePerHead
                 : rateType === 'per_head' || rateType === 'per_head_month' ? ratePerHead
                 : rateType === 'per_aum' ? ratePerAum : 0
      if (rate > 0) {
        calculatedCost = calcAnimalCost(headCount * pDays, null, rateType, rate)
      } else {
        calculatedCost = calcPeriodLevelCost(pDays, rateType, rateType === 'per_acre' ? ratePerAcre : flatRate, acreage)
      }
    }

    const byOwner = [...ownerShares.values()]
      .sort((a, b) => b.animal_days - a.animal_days)

    return {
      ...p,
      days: pDays,
      calculated_cost: calculatedCost,
      pair_calves_excluded: pairCalvesExcluded,
      by_owner: byOwner,
    }
  })

  const total_owed   = periodsWithCosts.reduce((s, p) => s + (p.calculated_cost as number), 0)
  const total_paid   = periodsWithCosts
    .filter(p => (p as Record<string, unknown>).is_paid)
    .reduce((s, p) => s + (p.calculated_cost as number), 0)
  const total_unpaid = total_owed - total_paid

  return NextResponse.json({
    periods: periodsWithCosts,
    summary: {
      total_owed,
      total_paid,
      total_unpaid,
      period_count: periods.length,
      rate_used: getRateLabel(rateType, {
        rate_per_head: lease.rate_per_head as number | null,
        rate_per_acre: lease.rate_per_acre as number | null,
        rate_per_aum:  lease.rate_per_aum  as number | null,
        flat_rate:     lease.flat_rate      as number | null,
        acreage:       lease.acreage        as number | null,
      }),
    },
  })
}
