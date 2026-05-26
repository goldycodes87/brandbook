export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const status   = searchParams.get('status') ?? ''
  const sex      = searchParams.get('sex') ?? ''
  const owner_id = searchParams.get('owner_id') ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit    = 50
  const offset   = (page - 1) * limit

  let query = supabase
    .from('animals')
    .select(
      `id, tag_number, name, dob, sex, status, breed, breed_percentage, photos,
       owner:owner_id ( id, name ),
       weights ( weight_lbs, weighed_at )`,
      { count: 'exact' }
    )
    .order('tag_number', { ascending: true })
    .order('weighed_at', { referencedTable: 'weights', ascending: false })
    .range(offset, offset + limit - 1)

  if (search)   query = query.or(`tag_number.ilike.%${search}%,name.ilike.%${search}%`)
  if (status)   query = query.eq('status', status)
  if (sex)      query = query.eq('sex', sex)
  if (owner_id) query = query.eq('owner_id', owner_id)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const animals = (data ?? []).map(a => {
    const sorted = [...(a.weights ?? [])].sort(
      (x, y) => new Date(y.weighed_at).getTime() - new Date(x.weighed_at).getTime()
    )
    return { ...a, weights: undefined, latest_weight: sorted[0] ?? null }
  })

  return NextResponse.json({ data: animals, count, page, limit })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('animals')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
