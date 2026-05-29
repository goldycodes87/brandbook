export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const sp         = req.nextUrl.searchParams
  const search     = sp.get('search') ?? ''
  const bull_type  = sp.get('bull_type') ?? ''
  const breed      = sp.get('breed') ?? ''
  const active_only = sp.get('active_only') !== 'false'
  const limit      = Math.min(Number(sp.get('limit') ?? 100), 500)
  const offset     = Number(sp.get('offset') ?? 0)

  const supabase = createAdminClient()

  let query = (supabase as any)
    .from('sire_library')
    .select('*', { count: 'exact' })
    .order('bull_name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (active_only) query = query.eq('is_active', true)
  if (bull_type)   query = query.eq('bull_type', bull_type)
  if (breed)       query = query.ilike('breed', `%${breed}%`)
  if (search)      query = query.or(`bull_name.ilike.%${search}%,naab_code.ilike.%${search}%,stud.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], count })
}

export async function POST(req: NextRequest) {
  const body     = await req.json()
  const supabase = createAdminClient()

  if (!body.bull_name?.trim()) return NextResponse.json({ error: 'Bull name required' }, { status: 400 })

  const row = {
    bull_name:           body.bull_name.trim(),
    bull_type:           body.bull_type ?? 'ai_sire',
    breed:               body.breed || null,
    registration_number: body.registration_number || null,
    naab_code:           body.naab_code || null,
    stud:                body.stud || null,
    birth_year:          body.birth_year ? Number(body.birth_year) : null,
    is_active:           body.is_active ?? true,
    source:              body.source ?? 'manual',
    photo_url:           body.photo_url || null,
    notes:               body.notes || null,
    epd_bw:       toNum(body.epd_bw),       epd_ww:    toNum(body.epd_ww),
    epd_yw:       toNum(body.epd_yw),       epd_milk:  toNum(body.epd_milk),
    epd_tm:       toNum(body.epd_tm),       epd_cw:    toNum(body.epd_cw),
    epd_rea:      toNum(body.epd_rea),      epd_fat:   toNum(body.epd_fat),
    epd_marbling: toNum(body.epd_marbling),
    epd_dollar_w: toNum(body.epd_dollar_w), epd_dollar_f: toNum(body.epd_dollar_f),
    epd_dollar_g: toNum(body.epd_dollar_g), epd_dollar_b: toNum(body.epd_dollar_b),
    acc_bw:       toNum(body.acc_bw),       acc_ww:    toNum(body.acc_ww),
    acc_yw:       toNum(body.acc_yw),
    epd_source:      body.epd_source || null,
    epd_updated_at:  body.epd_updated_at || null,
    import_batch_id: body.import_batch_id || null,
  }

  const { data, error } = await (supabase as any)
    .from('sire_library')
    .insert(row)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
