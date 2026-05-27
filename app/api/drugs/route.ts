export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl

  const search     = searchParams.get('search')
  const drug_class = searchParams.get('drug_class')
  const route      = searchParams.get('route')
  const source     = searchParams.get('source')
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  let query = supabase
    .from('drug_library')
    .select('id, brand_name, generic_name, manufacturer, ndc_code, route, species, drug_class, source, is_active, barcode, use_count, community_status, withdrawal_days_meat, withdrawal_days_milk, dosage_info')
    .eq('is_active', true)
    .order('source', { ascending: true })       // 'master' sorts before 'community'
    .order('use_count', { ascending: false })
    .limit(limit)

  if (search)     query = query.or(`brand_name.ilike.%${search}%,generic_name.ilike.%${search}%`)
  if (drug_class) query = query.eq('drug_class', drug_class)
  if (route)      query = query.eq('route', route)
  if (source)     query = query.eq('source', source)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('drug_library')
    .insert({
      ...body,
      source:           'community',
      community_status: 'pending',
      is_active:        false,
      use_count:        0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
