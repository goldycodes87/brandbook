export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('grazing_owners')
    .select('id, name, email, phone, address, city, state, zip, billing_address, billing_rate, billing_type, brand_photo_url, default_breed, default_ear_tag_color, default_tag_prefix, notes, profile_id, created_at')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { name, email, phone, address, city, state, zip, billing_address, billing_rate, billing_type, brand_photo_url, default_breed, default_ear_tag_color, default_tag_prefix, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('grazing_owners')
    .insert({
      name: name.trim(),
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      billing_address: billing_address || null,
      billing_rate: billing_rate ? Number(billing_rate) : null,
      billing_type: billing_type || null,
      brand_photo_url: brand_photo_url || null,
      default_breed: default_breed || null,
      default_ear_tag_color: default_ear_tag_color || null,
      default_tag_prefix: default_tag_prefix || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
