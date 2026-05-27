export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ranch_settings')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    data: data ?? {
      ranch_name: '',
      owner_name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
      timezone: 'America/Denver',
      logo_url: null,
      brand_photo_url: null,
    }
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { data: existing } = await supabase
    .from('ranch_settings')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let result
  if (existing?.id) {
    const { data, error } = await supabase
      .from('ranch_settings')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await supabase
      .from('ranch_settings')
      .insert({ ...body, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json({ data: result })
}
