export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const animal_id  = sp.get('animal_id')
  const event_type = sp.get('event_type')
  const date_from  = sp.get('date_from')
  const date_to    = sp.get('date_to')
  const limit      = Math.min(Number(sp.get('limit') ?? 50), 200)
  const offset     = Number(sp.get('offset') ?? 0)

  const supabase = createAdminClient()

  let query = supabase
    .from('reproduction_events')
    .select(
      `id, event_type, event_date, breed_method, conception_method,
       sire_name_text, expected_calving_date, calving_ease_score,
       preg_check_result, preg_check_method, days_bred,
       weaning_date, weaning_weight_lbs, ai_technician, notes, created_at,
       animal:animal_id ( id, tag_number, name, ear_tag_color, sex ),
       sire:sire_id ( id, tag_number, name ),
       calf:calf_id ( id, tag_number, name, sex )`,
      { count: 'exact' }
    )
    .order('event_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (animal_id)  query = query.eq('animal_id', animal_id)
  if (event_type) query = query.eq('event_type', event_type)
  if (date_from)  query = query.gte('event_date', date_from)
  if (date_to)    query = query.lte('event_date', date_to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('[calving POST] full body:', JSON.stringify(body, null, 2))
  const {
    animal_id,
    event_type,
    event_date,
    sire_id,
    sire_name_text,
    sire_library_id,
    breed_method,
    conception_method,
    ai_technician,
    expected_calving_date,
    calving_ease_score,
    preg_check_result,
    preg_check_method,
    days_bred,
    weaning_date,
    weaning_weight_lbs,
    weaned_calf_id,
    donor_dam_id,
    notes,
    create_calf,
    calf_data,
  } = body

  if (!animal_id)  return NextResponse.json({ error: 'animal_id is required' }, { status: 400 })
  if (!event_type) return NextResponse.json({ error: 'event_type is required' }, { status: 400 })
  if (!event_date) return NextResponse.json({ error: 'event_date is required' }, { status: 400 })

  if (event_type === 'calved' && calf_data) {
    console.log('[BREED DEBUG] received breeds:', JSON.stringify(calf_data?.breeds))
    console.log('[BREED DEBUG] sire_id:', calf_data?.sire_id, 'sire_library_id:', calf_data?.sire_library_id)
  }

  const supabase = createAdminClient()

  // Auto-calculate expected_calving_date when breeding event
  const estCalving =
    expected_calving_date ||
    (event_type === 'bred' && event_date ? addDays(event_date, 283) : null)

  const eventRow = {
    animal_id,
    event_type,
    event_date,
    sire_id: sire_id || null,
    sire_name_text: sire_name_text || null,
    sire_library_id: sire_library_id || null,
    breed_method: breed_method || null,
    conception_method: conception_method || null,
    ai_technician: ai_technician || null,
    expected_calving_date: estCalving,
    calving_ease_score: calving_ease_score ?? null,
    preg_check_result: preg_check_result || null,
    preg_check_method: preg_check_method || null,
    days_bred: days_bred ?? null,
    weaning_date: event_type === 'weaned' ? (weaning_date || event_date) : null,
    weaning_weight_lbs: event_type === 'weaned' ? (weaning_weight_lbs ?? null) : null,
    donor_dam_id: donor_dam_id || null,
    notes: notes || null,
  }

  if (!create_calf || !calf_data) {
    const { data, error } = await supabase
      .from('reproduction_events')
      .insert(eventRow)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (event_type === 'calved') {
      const { data: dam } = await supabase.from('animals').select('sex').eq('id', animal_id).single()
      if (dam?.sex === 'heifer') {
        await supabase.from('animals').update({ sex: 'cow' }).eq('id', animal_id)
        console.log('[repro] heifer promoted to cow:', animal_id)
      }
    }

    if (event_type === 'weaned' && weaned_calf_id) {
      const { data: calfAnimal } = await supabase
        .from('animals')
        .select('calf_sex')
        .eq('id', weaned_calf_id)
        .single()
      const newSex =
        calfAnimal?.calf_sex === 'heifer_calf' ? 'heifer' :
        calfAnimal?.calf_sex === 'bull_calf'   ? 'bull'   : 'steer'
      await supabase.from('animals').update({
        sex:                newSex,
        weaning_date:       weaning_date || event_date,
        weaning_weight_lbs: weaning_weight_lbs ?? null,
      }).eq('id', weaned_calf_id)
    }

    return NextResponse.json({ data }, { status: 201 })
  }

  // Calving path: create event + calf animal + link back
  const { data: reproEvent, error: reproErr } = await supabase
    .from('reproduction_events')
    .insert({
      ...eventRow,
      event_type:      'calved',
      sire_library_id: calf_data?.sire_library_id || eventRow.sire_library_id || null,
    })
    .select()
    .single()

  if (reproErr) return NextResponse.json({ error: reproErr.message }, { status: 500 })

  // Fetch dam to inherit owner_id and check if heifer
  const { data: damRecord } = await supabase
    .from('animals')
    .select('owner_id, sex')
    .eq('id', animal_id)
    .single()

  // Create calf animal — sex always 'calf' at birth, calf_sex stores biological sex
  const { data: newCalf, error: calfErr } = await supabase
    .from('animals')
    .insert({
      tag_number:              calf_data.tag_number,
      ear_tag_color:           calf_data.ear_tag_color || null,
      sex:                     'calf',
      calf_sex:                calf_data.calf_sex || null,
      status:                  'active',
      dob:                     calf_data.dob || event_date,
      birth_weight_lbs:        calf_data.birth_weight_lbs || null,
      birth_weight_estimated:  calf_data.birth_weight_estimated ?? true,
      breeds:                  calf_data.breeds || [],
      dam_id:                  animal_id,
      owner_id:                damRecord?.owner_id || null,
      sire_id:                 calf_data.sire_id || null,
      sire_library_id:         calf_data.sire_library_id || null,
      donor_dam_id:            calf_data.donor_dam_id || null,
      conception_method:       calf_data.conception_method || null,
      birth_type:              calf_data.birth_type || 'single',
      vigor_score:             calf_data.vigor_score ?? null,
      notes:                   calf_data.notes || null,
    })
    .select()
    .single()

  if (calfErr) return NextResponse.json({ error: calfErr.message }, { status: 500 })
  console.log('[calving POST] calf inserted:', JSON.stringify({
    id:              newCalf.id,
    breeds:          newCalf.breeds,
    sire_id:         newCalf.sire_id,
    sire_library_id: newCalf.sire_library_id,
    ear_tag_color:   newCalf.ear_tag_color,
  }))

  // Link calf back to the reproduction event
  await supabase
    .from('reproduction_events')
    .update({ calf_id: newCalf.id })
    .eq('id', reproEvent.id)

  // Increment use_count on sire library entry
  const usedSireLibraryId = calf_data?.sire_library_id || null
  if (usedSireLibraryId) {
    const { data: currentSire } = await supabase
      .from('sire_library')
      .select('use_count')
      .eq('id', usedSireLibraryId)
      .single()
    await supabase
      .from('sire_library')
      .update({ use_count: (currentSire?.use_count || 0) + 1 })
      .eq('id', usedSireLibraryId)
  }

  // Promote heifer to cow on first calving
  if (damRecord?.sex === 'heifer') {
    await supabase.from('animals').update({ sex: 'cow' }).eq('id', animal_id)
    console.log('[repro] heifer promoted to cow:', animal_id)
  }

  return NextResponse.json(
    { repro_event: { ...reproEvent, calf_id: newCalf.id }, calf: newCalf },
    { status: 201 }
  )
}
