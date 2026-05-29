export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('grazing_owners')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { name, company_name, owner_name, email, phone, address, city, state, zip, billing_address, billing_rate, billing_type, brand_photo_url, brand_drawing_url, default_breed, default_ear_tag_color, default_tag_prefix, notes } = body

  const displayName = (name || company_name || owner_name || '').trim()
  if (!displayName) return NextResponse.json({ error: 'Company name or owner name is required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    name: displayName,
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
    brand_drawing_url: brand_drawing_url || null,
    default_breed: default_breed || null,
    default_ear_tag_color: default_ear_tag_color || null,
    default_tag_prefix: default_tag_prefix || null,
    notes: notes || null,
  }

  // Include new columns — silently drop if migration hasn't run yet
  if (company_name !== undefined) row.company_name = company_name || null
  if (owner_name !== undefined)   row.owner_name   = owner_name   || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (supabase as any).from('grazing_owners').insert(row).select().single()

  // Retry without new columns if they don't exist yet
  if (error?.code === '42703') {
    delete row.company_name
    delete row.owner_name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;({ data, error } = await (supabase as any).from('grazing_owners').insert(row).select().single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
