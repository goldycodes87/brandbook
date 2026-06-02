// IMPORTANT: Never nest animals
// table joins inside animals query.
// PostgREST PGRST201 error.
// Always fetch dam/sire/calves/
// donor_dam as separate queries.
// See: github.com/supabase/postgrest
// This rule cannot be changed.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  // Main animal query
  // NO nested animals joins ever
  const { data: animal, error } =
    await supabase
      .from('animals')
      .select(`
        *,
        weights (
          id, weight_lbs,
          weighed_at, source, notes
        ),
        health_events (
          id, event_type, event_date,
          drug_name, dose_amount,
          dose_unit, withdrawal_days,
          withdrawal_clear_date,
          bcs_score, administered_by,
          notes, created_at
        ),
        reproduction_events!reproduction_events_animal_id_fkey (
          id,
          event_type,
          event_date,
          expected_calving_date,
          calving_ease_score,
          preg_check_result,
          preg_check_method,
          breed_method,
          ai_technician,
          conception_method,
          sire_name_text,
          sire_id,
          sire_library_id,
          days_bred,
          donor_dam_id,
          calf_id,
          weaning_date,
          weaning_weight_lbs,
          notes,
          created_at,
          sire:sire_id ( id, tag_number, name ),
          sire_library:sire_library_id ( id, bull_name, breed, naab_code, bull_type ),
          calf:calf_id ( id, tag_number, name, sex, calf_sex, dob, birth_weight_lbs )
        ),
        grazing_assignments (
          id, start_date, end_date
        )
      `)
      .eq('id', id)
      .maybeSingle()

  if (error) {
    console.error(
      '[animals/id GET] error:',
      error.code, error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 500 })
  }

  if (!animal) {
    return NextResponse.json(
      { error: 'Animal not found' },
      { status: 404 })
  }

  // Separate query for dam
  // NEVER inside main query
  let dam = null
  if (animal.dam_id) {
    const { data } = await supabase
      .from('animals')
      .select(`
        id, tag_number, name,
        sex, breed, breeds,
        ear_tag_color, photos,
        status
      `)
      .eq('id', animal.dam_id)
      .maybeSingle()
    dam = data
  }

  // Separate query for sire
  let sire = null
  if (animal.sire_id) {
    const { data } = await supabase
      .from('animals')
      .select(`
        id, tag_number, name,
        sex, breed, breeds,
        ear_tag_color, photos,
        status
      `)
      .eq('id', animal.sire_id)
      .maybeSingle()
    sire = data
  }

  // Separate query for donor dam
  let donor_dam = null
  if (animal.donor_dam_id) {
    const { data } = await supabase
      .from('animals')
      .select(`
        id, tag_number, name,
        sex, breed, breeds,
        ear_tag_color, photos
      `)
      .eq('id', animal.donor_dam_id)
      .maybeSingle()
    donor_dam = data
  }

  // Separate query for calves
  const { data: calves } =
    await supabase
      .from('animals')
      .select(`
        id, tag_number, name,
        sex, calf_sex, dob, photos,
        ear_tag_color, status,
        conception_method,
        birth_weight_lbs,
        weaning_date,
        weaning_weight_lbs
      `)
      .or(
        `dam_id.eq.${id},` +
        `sire_id.eq.${id}`
      )
      .eq('status', 'active')
      .order('dob', {
        ascending: false
      })

  // Separate query for owner
  let owner = null
  if (animal.owner_id) {
    const { data } = await supabase
      .from('grazing_owners')
      .select(`
        id, name, email,
        phone, billing_type,
        billing_rate
      `)
      .eq('id', animal.owner_id)
      .maybeSingle()
    owner = data
  }

  // Separate query for sire library
  let sire_library = null
  if (animal.sire_library_id) {
    const { data } = await supabase
      .from('sire_library')
      .select('id, bull_name, breed, naab_code, stud, bull_type')
      .eq('id', animal.sire_library_id)
      .maybeSingle()
    sire_library = data
  }

  // Separate query for pair animal
  let pair_animal = null
  if (animal.pair_animal_id) {
    const { data } = await supabase
      .from('animals')
      .select('id, tag_number, name, sex, calf_sex, status, ear_tag_color')
      .eq('id', animal.pair_animal_id)
      .maybeSingle()
    pair_animal = data
  }

  return NextResponse.json({
    data: {
      ...animal,
      dam,
      sire,
      sire_library,
      donor_dam,
      calves: calves || [],
      owner,
      pair_animal,
    }
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const firstBreed = Array.isArray(body.breeds) ? body.breeds[0] : null

  const updateData = {
    tag_number:           body.tag_number,
    name:                 body.name ?? null,
    sex:                  body.sex,
    status:               body.status ?? 'active',
    dob:                  body.dob || null,
    dob_estimated:        body.dob_estimated ?? null,
    approximate_age:      body.approximate_age || null,
    breed:                firstBreed?.breed || body.breed || null,
    breed_percentage:     firstBreed?.pct   || body.breed_percentage || null,
    breeds:               body.breeds ?? [],
    ear_tag_color:        body.ear_tag_color,
    ear_tag_number:       body.ear_tag_number || null,
    birth_weight_lbs:     body.birth_weight_lbs || null,
    purchase_price:       body.purchase_price || null,
    purchase_date:        body.purchase_date || null,
    vendor:               body.vendor || null,
    owner_id:             body.owner_id || null,
    dam_id:               body.dam_id || null,
    sire_id:              body.sire_id || null,
    sire_library_id:      body.sire_library_id || null,
    registration_numbers: body.registration_numbers ?? [],
    notes:                body.notes || null,
    photos:               body.photos ?? [],
  }

  const { data, error } = await supabase
    .from('animals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('animals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
