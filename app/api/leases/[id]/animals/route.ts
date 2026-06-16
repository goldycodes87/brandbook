export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: assignments, error: assignError } = await supabase
    .from('grazing_assignments')
    .select('animal_id, start_date, id')
    .eq('lease_id', id)
    .is('end_date', null)

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })

  const assignMap = new Map(
    (assignments ?? []).map((a: { animal_id: string; start_date: string; id: string }) => [
      a.animal_id,
      { start_date: a.start_date, assignment_id: a.id },
    ])
  )

  const animalIds = [...assignMap.keys()]
  if (!animalIds.length) return NextResponse.json({ data: [] })

  const { data: animals, error } = await supabase
    .from('animals')
    .select('id, tag_number, name, ear_tag_color, sex, status, owner_id, weaning_date')
    .in('id', animalIds)
    .eq('status', 'active')
    .order('tag_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  const data = (animals ?? []).map((a: {
    id: string; tag_number: string; name: string | null; ear_tag_color: string | null
    sex: string | null; status: string | null; owner_id: string | null
  }) => ({
    ...a,
    owner_name:    a.owner_id ? (ownerMap[a.owner_id] ?? null) : null,
    start_date:    assignMap.get(a.id)?.start_date ?? null,
    assignment_id: assignMap.get(a.id)?.assignment_id ?? null,
  }))

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

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('grazing_assignments')
    .update({ end_date: today })
    .eq('lease_id', id)
    .eq('animal_id', animal_id)
    .is('end_date', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
