export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('animals')
    .select(`
      *,
      owner:owner_id ( id, name, email, phone ),
      dam:dam_id ( id, tag_number, name, sex, photos ),
      sire:sire_id ( id, tag_number, name, sex, photos ),
      weights ( id, weight_lbs, weighed_at, source, notes ),
      health_events ( id, event_type, event_date, drug_name, dose_amount, dose_unit, withdrawal_days, withdrawal_clear_date, bcs_score, administered_by, notes ),
      reproduction_events ( id, event_type, event_date, breed_method, expected_calving_date, calving_ease_score, preg_check_result, weaning_date, weaning_weight_lbs, notes,
        sire:sire_id ( id, tag_number, name ),
        calf:calf_id ( id, tag_number, name )
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[animals/id GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    console.log('[animals/id GET] not found:', id)
    return NextResponse.json({ error: 'Animal not found' }, { status: 404 })
  }

  // Separate query to avoid self-join ambiguity (both dam_id and sire_id FK to animals)
  const { data: calves } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, dob, photos, ear_tag_color')
    .or(`dam_id.eq.${id},sire_id.eq.${id}`)
    .eq('status', 'active')

  return NextResponse.json({ ...data, calves: calves ?? [] })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('animals')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('animals')
    .update({ status: 'deceased' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
