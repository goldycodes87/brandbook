export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('semen_inventory')
    .select(`
      *,
      sire_library:sire_library_id (
        id, bull_name, breed, epd_ced, epd_bw, epd_ww, epd_yw, epd_marbling, naab_code
      )
    `)
    .order('sire_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { id, straw_count } = await req.json()
  if (!id || straw_count === undefined) {
    return NextResponse.json({ error: 'id and straw_count required' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('semen_inventory')
    .update({ straw_count: Number(straw_count) })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    sire_library_id, sire_name, tank_name, canister, cane,
    straw_count, price_per_straw, straw_size, is_sexed,
    purchase_date, notes,
  } = body

  if (!sire_library_id && !sire_name) {
    return NextResponse.json({ error: 'sire_library_id or sire_name required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (sire_library_id) {
    const { data: existing } = await supabase
      .from('semen_inventory')
      .select('id, straw_count')
      .eq('sire_library_id', sire_library_id)
      .maybeSingle()

    if (existing) {
      const updates: Record<string, unknown> = {
        straw_count: (existing.straw_count ?? 0) + Number(straw_count ?? 0),
      }
      if (price_per_straw != null) updates.price_per_straw = Number(price_per_straw)
      const { data, error } = await supabase
        .from('semen_inventory')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }
  }

  let resolvedSireName = sire_name
  if (sire_library_id && !sire_name) {
    const { data: sl } = await supabase.from('sire_library').select('bull_name').eq('id', sire_library_id).single()
    resolvedSireName = sl?.bull_name ?? 'Unknown'
  }

  const { data, error } = await supabase
    .from('semen_inventory')
    .insert({
      sire_library_id:  sire_library_id || null,
      sire_name:        resolvedSireName,
      tank_name:        tank_name || 'Legacy Tank',
      canister:         canister || null,
      cane:             cane || null,
      straw_count:      Number(straw_count ?? 0),
      price_per_straw:  price_per_straw != null ? Number(price_per_straw) : null,
      straw_size:       straw_size || '0.5cc',
      is_sexed:         Boolean(is_sexed),
      purchase_date:    purchase_date || null,
      notes:            notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
