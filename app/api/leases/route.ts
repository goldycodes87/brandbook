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

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const status = req.nextUrl.searchParams.get('status')

  let query = supabase
    .from('leases')
    .select('*')
    .order('end_date', { ascending: true })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const row: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (k in body) row[k] = body[k] === '' ? null : body[k]
  }
  if (row.acreage != null) row.acreage = Number(row.acreage)
  if (row.total_aum_capacity != null) row.total_aum_capacity = Number(row.total_aum_capacity)
  if (row.rate_per_acre != null) row.rate_per_acre = Number(row.rate_per_acre)
  if (row.flat_rate != null) row.flat_rate = Number(row.flat_rate)
  if (row.renewal_alert_days != null) row.renewal_alert_days = Number(row.renewal_alert_days)

  const { data, error } = await supabase.from('leases').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
