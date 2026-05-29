export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('sire_library')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body     = await req.json()
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const textFields = ['bull_name', 'bull_type', 'breed', 'registration_number', 'naab_code', 'stud', 'photo_url', 'notes', 'epd_source']
  textFields.forEach(f => { if (f in body) updates[f] = body[f] || null })

  if ('birth_year'  in body) updates.birth_year = body.birth_year ? Number(body.birth_year) : null
  if ('is_active'   in body) updates.is_active  = body.is_active

  const epdFields = ['epd_bw','epd_ww','epd_yw','epd_milk','epd_tm','epd_cw','epd_rea','epd_fat','epd_marbling','epd_dollar_w','epd_dollar_f','epd_dollar_g','epd_dollar_b','acc_bw','acc_ww','acc_yw']
  epdFields.forEach(f => { if (f in body) updates[f] = toNum(body[f]) })

  const { data, error } = await (supabase as any)
    .from('sire_library')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await (supabase as any)
    .from('sire_library')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
