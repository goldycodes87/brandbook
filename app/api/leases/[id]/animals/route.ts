export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const includePast = req.nextUrl.searchParams.get('include_past') === '1'

  // Fetch assignments — active only, or all if history requested
  let assignQuery = supabase
    .from('grazing_assignments')
    .select('animal_id, start_date, end_date, id')
    .eq('lease_id', id)
    .order('start_date', { ascending: false })

  if (!includePast) assignQuery = assignQuery.is('end_date', null)

  const { data: assignments, error: assignError } = await assignQuery
  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })

  type AssignRow = { animal_id: string; start_date: string; end_date: string | null; id: string }

  // For history mode, group all assignments per animal_id
  // For active mode, one entry per animal_id
  const assignsByAnimal = new Map<string, AssignRow[]>()
  for (const a of (assignments ?? []) as AssignRow[]) {
    if (!assignsByAnimal.has(a.animal_id)) assignsByAnimal.set(a.animal_id, [])
    assignsByAnimal.get(a.animal_id)!.push(a)
  }

  const animalIds = [...new Set((assignments ?? []).map((a: AssignRow) => a.animal_id))]
  if (!animalIds.length) return NextResponse.json({ data: [] })

  const { data: animals, error } = await supabase
    .from('animals')
    .select('id, tag_number, name, ear_tag_color, sex, status, owner_id, weaning_date')
    .in('id', animalIds)
    .order('tag_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: ranchData } = await supabase
    .from('ranch_settings')
    .select('ranch_name')
    .limit(1)
    .maybeSingle()
  const ranchName = (ranchData as { ranch_name?: string | null } | null)?.ranch_name?.trim() || 'My Ranch'

  const ownerIds = [
    ...new Set(
      (animals ?? [])
        .map((a: { owner_id: string | null }) => a.owner_id)
        .filter(Boolean) as string[]
    ),
  ]
  const ownerMap: Record<string, string> = {}
  if (ownerIds.length) {
    const { data: owners } = await supabase
      .from('grazing_owners')
      .select('id, name, company_name, owner_name')
      .in('id', ownerIds)
    for (const o of (owners ?? []) as Array<{
      id: string; name: string; company_name: string | null; owner_name: string | null
    }>) {
      ownerMap[o.id] = o.company_name || o.owner_name || o.name || 'Unknown'
    }
  }

  const animalDataMap = new Map(
    (animals ?? []).map((a: {
      id: string; tag_number: string; name: string | null; ear_tag_color: string | null
      sex: string | null; status: string | null; owner_id: string | null; weaning_date: string | null
    }) => [a.id, a])
  )

  // Expand: one row per assignment (for history) or per animal (active only)
  const data: unknown[] = []
  for (const [animalId, animalAssigns] of assignsByAnimal) {
    const animal = animalDataMap.get(animalId)
    if (!animal) continue
    const ownerName = animal.owner_id ? (ownerMap[animal.owner_id] ?? ranchName) : ranchName
    for (const assign of animalAssigns) {
      data.push({
        ...animal,
        owner_name:    ownerName,
        start_date:    assign.start_date,
        end_date:      assign.end_date ?? null,
        assignment_id: assign.id,
      })
    }
  }

  // Sort: active first (no end_date), then by tag_number
  data.sort((a: unknown, b: unknown) => {
    const ar = a as { end_date: string | null; tag_number: string }
    const br = b as { end_date: string | null; tag_number: string }
    if (!ar.end_date && br.end_date) return -1
    if (ar.end_date && !br.end_date) return 1
    return ar.tag_number.localeCompare(br.tag_number)
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const animal_ids: string[] = Array.isArray(body.animal_ids) ? body.animal_ids : [body.animal_id]
  const start_date: string = body.start_date ?? new Date().toISOString().slice(0, 10)

  const rows = animal_ids.map((animal_id: string) => ({ lease_id: id, animal_id, start_date }))
  const { error } = await supabase.from('grazing_assignments').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const animal_id = req.nextUrl.searchParams.get('animal_id')
  if (!animal_id) return NextResponse.json({ error: 'animal_id required' }, { status: 400 })

  const end_date = req.nextUrl.searchParams.get('end_date') || new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('grazing_assignments')
    .update({ end_date })
    .eq('lease_id', id)
    .eq('animal_id', animal_id)
    .is('end_date', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
