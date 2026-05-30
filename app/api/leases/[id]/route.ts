export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED = [
  'property_name', 'landowner_name', 'landowner_email', 'landowner_phone',
  'acreage', 'total_aum_capacity', 'legal_description', 'parcel_id', 'parcel_ids',
  'county', 'state', 'start_date', 'end_date',
  'rate_per_acre', 'rate_per_head', 'rate_per_aum', 'flat_rate',
  'rate_type', 'payment_frequency', 'renewal_alert_days', 'auto_renew',
  'status', 'notes', 'map_coordinates', 'landowner_portal_enabled',
]

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('leases').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const clean: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (k in body) clean[k] = body[k] === '' ? null : body[k]
  }
  if (clean.acreage != null) clean.acreage = Number(clean.acreage)
  if (clean.total_aum_capacity != null) clean.total_aum_capacity = Number(clean.total_aum_capacity)
  if (clean.rate_per_acre != null) clean.rate_per_acre = Number(clean.rate_per_acre)
  if (clean.flat_rate != null) clean.flat_rate = Number(clean.flat_rate)
  if (clean.renewal_alert_days != null) clean.renewal_alert_days = Number(clean.renewal_alert_days)

  const { data, error } = await supabase.from('leases').update(clean).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('leases').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
