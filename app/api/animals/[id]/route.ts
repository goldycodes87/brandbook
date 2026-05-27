export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: animal, error } = await supabase
    .from('animals')
    .select(`
      *,
      weights (
        id,
        weight_lbs,
        weighed_at,
        source,
        notes
      ),
      health_events (
        id,
        event_type,
        event_date,
        drug_name,
        dose_amount,
        dose_unit,
        withdrawal_days,
        withdrawal_clear_date,
        bcs_score,
        administered_by,
        notes
      ),
      reproduction_events (
        id,
        event_type,
        event_date,
        expected_calving_date,
        calving_ease_score,
        preg_check_result,
        notes
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[animals/id GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!animal) {
    console.log('[animals/id GET] not found:', id)
    return NextResponse.json({ error: 'Animal not found' }, { status: 404 })
  }

  // Dam
  let dam = null
  if (animal.dam_id) {
    const { data } = await supabase
      .from('animals')
      .select('id, tag_number, name, sex, breed, photos, ear_tag_color')
      .eq('id', animal.dam_id)
      .maybeSingle()
    dam = data
  }

  // Sire
  let sire = null
  if (animal.sire_id) {
    const { data } = await supabase
      .from('animals')
      .select('id, tag_number, name, sex, breed, photos, ear_tag_color')
      .eq('id', animal.sire_id)
      .maybeSingle()
    sire = data
  }

  // Calves
  const { data: calves } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, dob, photos, ear_tag_color, status')
    .or(`dam_id.eq.${id},sire_id.eq.${id}`)
    .eq('status', 'active')
    .order('dob', { ascending: false })

  // Owner
  let owner = null
  if (animal.owner_id) {
    const { data } = await supabase
      .from('grazing_owners')
      .select('id, name, email, phone, billing_type, billing_rate')
      .eq('id', animal.owner_id)
      .maybeSingle()
    owner = data
  }

  console.log('[animals/id] animal found:', !!animal, 'dam:', !!dam, 'sire:', !!sire, 'calves:', calves?.length)

  return NextResponse.json({
    data: {
      ...animal,
      dam,
      sire,
      calves: calves || [],
      owner,
    }
  })
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
