export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SORT_MAP: Record<string, string> = {
  name:     'bull_name',
  bw:       'epd_bw',
  ww:       'epd_ww',
  yw:       'epd_yw',
  milk:     'epd_milk',
  dollar_b: 'epd_dollar_b',
  used:     'use_count',
}

export async function GET(req: NextRequest) {
  const sp          = req.nextUrl.searchParams
  const search      = sp.get('search') ?? ''
  const bull_type   = sp.get('bull_type') ?? ''
  const breed       = sp.get('breed') ?? ''
  const stud        = sp.get('stud') ?? ''
  const source      = sp.get('source') ?? ''
  const sort        = sp.get('sort') ?? 'name'
  const dir         = sp.get('dir') ?? 'asc'
  const active_only = sp.get('active_only') !== 'false'
  const studs_only  = sp.get('studs_only') === 'true'
  const limit       = Math.min(Number(sp.get('limit') ?? 100), 500)
  const offset      = Number(sp.get('offset') ?? 0)

  const supabase = createAdminClient()

  // Return distinct stud names only
  if (studs_only) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('sire_library')
      .select('stud')
      .not('stud', 'is', null)
      .eq('is_active', true)
    const studs = [...new Set<string>((data ?? []).map((r: { stud: string }) => r.stud).filter(Boolean))].sort()
    return NextResponse.json({ studs })
  }

  const column    = SORT_MAP[sort] ?? 'bull_name'
  const ascending = dir !== 'desc'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('sire_library')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)

  // Apply sort — EPD columns push nulls last
  if (column.startsWith('epd_')) {
    query = query.order(column, { ascending, nullsFirst: false })
  } else {
    query = query.order(column, { ascending })
  }

  if (active_only) query = query.eq('is_active', true)
  if (bull_type)   query = query.eq('bull_type', bull_type)
  if (breed)       query = query.ilike('breed', `%${breed}%`)
  if (stud)        query = query.eq('stud', stud)
  if (source)      query = query.eq('source', source)
  if (search)      query = query.or(
    `bull_name.ilike.%${search}%,naab_code.ilike.%${search}%,stud.ilike.%${search}%,registration_number.ilike.%${search}%`
  )

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], count, total: count })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
