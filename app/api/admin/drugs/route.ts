export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * The formulary, seen from the office rather than the chute.
 *
 * /api/drugs is what the DrugSelector calls: active products only, ten at a
 * time, ranked by use. This one shows the whole library including retired
 * products, because retiring one is a decision somebody has to be able to see
 * and undo.
 */

const FIELDS =
  'id, brand_name, generic_name, manufacturer, ndc_code, barcode, route, species, drug_class,' +
  ' source, is_active, use_count, community_status, withdrawal_days_meat, withdrawal_days_milk,' +
  ' dosage_info, notes, created_at'

export async function GET(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const search   = searchParams.get('search')?.trim()
  const retired  = searchParams.get('retired') === '1'

  const supabase = createAdminClient()
  let query = supabase
    .from('drug_library')
    .select(FIELDS)
    .eq('is_active', !retired)
    .order('brand_name', { ascending: true })
    .limit(500)

  if (search) query = query.or(`brand_name.ilike.%${search}%,generic_name.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Counts for both shelves, so the room can label its own tabs without a
  // second round trip.
  const [{ count: activeCount }, { count: retiredCount }] = await Promise.all([
    supabase.from('drug_library').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('drug_library').select('id', { count: 'exact', head: true }).eq('is_active', false),
  ])

  return NextResponse.json({
    data: data ?? [],
    counts: { active: activeCount ?? 0, retired: retiredCount ?? 0 },
  })
}

// POST — add a product to this ranch's formulary. Live immediately, unlike
// /api/drugs POST, which is the community submission queue and lands pending.
export async function POST(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const brand = typeof body.brand_name === 'string' ? body.brand_name.trim() : ''
  if (!brand) return NextResponse.json({ error: 'A product name is required' }, { status: 400 })

  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }

  // Withdrawal is the whole point of the record, so it is required rather than
  // defaulted. A zero has to be typed, not inherited from the column default —
  // that default is how 300-odd imported products ended up claiming no
  // withdrawal at all.
  const meat = num(body.withdrawal_days_meat)
  const milk = num(body.withdrawal_days_milk)
  if (meat === null) return NextResponse.json({ error: 'Meat withdrawal days are required — read them off the label' }, { status: 400 })

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('drug_library')
    .insert({
      brand_name:   brand,
      generic_name: str(body.generic_name),
      manufacturer: str(body.manufacturer),
      barcode:      str(body.barcode),
      route:        str(body.route),
      drug_class:   str(body.drug_class),
      dosage_info:  str(body.dosage_info),
      notes:        str(body.notes),
      withdrawal_days_meat: meat,
      withdrawal_days_milk: milk ?? 0,
      source:    'master',
      is_active: true,
      use_count: 0,
    })
    .select(FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
