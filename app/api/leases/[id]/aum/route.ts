export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const today = new Date().toISOString().slice(0, 10)

  const { data: assignments, error: assignError } = await supabase
    .from('grazing_assignments')
    .select('animal_id')
    .eq('lease_id', id)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })
  if (!assignments?.length) {
    return NextResponse.json({ total_billable_units: 0, unweaned_calves_excluded: 0, by_owner: [] })
  }

  const animalIds = assignments.map((a: { animal_id: string }) => a.animal_id)

  const { data: animals, error: animalError } = await supabase
    .from('animals')
    .select('id, sex, weaning_date, dam_id, owner_id, status')
    .in('id', animalIds)
    .eq('status', 'active')

  if (animalError) return NextResponse.json({ error: animalError.message }, { status: 500 })
  if (!animals?.length) {
    return NextResponse.json({ total_billable_units: 0, unweaned_calves_excluded: 0, by_owner: [] })
  }

  // Unweaned calves: sex is calf/Calf, no weaning date, has a dam
  const unweanedSet = new Set(
    (animals as Array<{ id: string; sex: string | null; weaning_date: string | null; dam_id: string | null }>)
      .filter(a => (a.sex?.toLowerCase() === 'calf') && !a.weaning_date && a.dam_id)
      .map(a => a.id)
  )

  // Fetch owner names
  const ownerIds = [...new Set(
    (animals as Array<{ owner_id: string | null }>).map(a => a.owner_id).filter(Boolean) as string[]
  )]

  const ownerMap: Record<string, string> = {}
  if (ownerIds.length) {
    const { data: owners } = await supabase
      .from('grazing_owners')
      .select('id, name, company_name, owner_name')
      .in('id', ownerIds)
    for (const o of (owners ?? []) as Array<{ id: string; name: string; company_name: string | null; owner_name: string | null }>) {
      ownerMap[o.id] = o.company_name || o.owner_name || o.name || 'Unknown'
    }
  }

  // Group by owner
  const byOwnerMap: Record<string, { billable: number; calves_excluded: number }> = {}

  for (const a of animals as Array<{ id: string; owner_id: string | null }>) {
    const key = a.owner_id ?? '__unassigned__'
    if (!byOwnerMap[key]) byOwnerMap[key] = { billable: 0, calves_excluded: 0 }
    if (unweanedSet.has(a.id)) byOwnerMap[key].calves_excluded++
    else                       byOwnerMap[key].billable++
  }

  const totalBillable = Object.values(byOwnerMap).reduce((s, v) => s + v.billable, 0)

  const byOwner = Object.entries(byOwnerMap)
    .map(([owner_id, counts]) => ({
      owner_id:       owner_id === '__unassigned__' ? null : owner_id,
      owner_name:     owner_id === '__unassigned__' ? 'Legacy Land & Cattle' : (ownerMap[owner_id] ?? 'Unknown'),
      billable:       counts.billable,
      calves_excluded: counts.calves_excluded,
      percent_of_herd: totalBillable > 0 ? Math.round((counts.billable / totalBillable) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.billable - a.billable)

  return NextResponse.json({
    total_billable_units:    totalBillable,
    unweaned_calves_excluded: unweanedSet.size,
    by_owner: byOwner,
  })
}
