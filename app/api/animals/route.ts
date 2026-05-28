// IMPORTANT: Never nest animals
// table joins inside animals query.
// PostgREST PGRST201 - self-join
// ambiguity. Always use separate
// queries for related animals.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const status   = searchParams.get('status') ?? ''
  const sex      = searchParams.get('sex') ?? ''
  const owner_id = searchParams.get('owner_id') ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limitParam = searchParams.get('limit')
  const limit    = limitParam ? Math.min(Number(limitParam), 200) : 50
  const offset   = (page - 1) * limit

  let query = supabase
    .from('animals')
    .select(
      `id, tag_number, name, sex,
       status, breed, breeds,
       ear_tag_color, ear_tag_number,
       photos, dob, created_at,
       owner_id, dam_id, sire_id,
       conception_method,
       birth_weight_lbs,
       purchase_date, notes`,
      { count: 'exact' }
    )
    .order('tag_number', { ascending: true })
    .range(offset, offset + limit - 1)

  if (search)   query = query.or(`tag_number.ilike.%${search}%,name.ilike.%${search}%`)
  if (status)   query = query.eq('status', status)
  if (sex) {
    const sexValues = sex.split(',').map(s => s.trim()).filter(Boolean)
    if (sexValues.length === 1) {
      query = query.eq('sex', sexValues[0])
    } else if (sexValues.length > 1) {
      query = query.in('sex', sexValues)
    }
  }
  if (owner_id) query = query.eq('owner_id', owner_id)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], count, page, limit })
}

function toUuid(val: unknown): string | null {
  if (!val || val === '') return null
  return val as string
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const clean = Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, v === '' ? null : v])
  )

  const sanitized = {
    ...clean,
    owner_id: toUuid(clean.owner_id),
    dam_id:   toUuid(clean.dam_id),
    sire_id:  toUuid(clean.sire_id),
  }

  const { data, error } = await supabase
    .from('animals')
    .insert(sanitized)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
