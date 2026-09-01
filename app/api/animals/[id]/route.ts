export const dynamic = 'force-dynamic'

// IMPORTANT: Never nest animals
// table joins inside animals query.
// PostgREST PGRST201 error.
// Always fetch dam/sire/calves/
// donor_dam as separate queries.
// See: github.com/supabase/postgrest
// This rule cannot be changed.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Update } from '@/lib/supabase/admin'

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
          sire_library:sire_library_id ( id, bull_name, breed, naab_code, stud, bull_type ),
          calf:calf_id ( id, tag_number, name, sex, calf_sex, dob, birth_weight_lbs, ear_tag_color )
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
        weaning_weight_lbs,
        breeds,
        sire_library_id
      `)
      .eq('dam_id', id)
      .order('dob', {
        ascending: false,
        nullsFirst: false,
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

const asIs     = (v: unknown) => v
const orNull   = (v: unknown) => v || null
const nullable = (v: unknown) => v ?? null
const num      = (v: unknown) => (v != null ? Number(v) : null)

/**
 * Columns PATCH is allowed to write, and how each is read off the body.
 *
 * Anything absent from this map is ignored, so a client cannot write id,
 * created_at, or a column that belongs to another flow (weaning, breeding
 * eligibility, the AI fee override — each has its own endpoint).
 */
const PATCH_FIELDS: Record<string, (v: unknown) => unknown> = {
  tag_number:           asIs,
  name:                 nullable,
  sex:                  asIs,
  status:               v => v ?? 'active',
  dob:                  orNull,
  dob_estimated:        nullable,
  approximate_age:      orNull,
  ear_tag_color:        asIs,
  ear_tag_number:       orNull,
  birth_weight_lbs:     orNull,
  purchase_price:       orNull,
  purchase_date:        orNull,
  vendor:               orNull,
  owner_id:             orNull,
  dam_id:               orNull,
  sire_id:              orNull,
  sire_library_id:      orNull,
  registration_numbers: v => v ?? [],
  notes:                orNull,
  photos:               v => v ?? [],
  origin:               nullable,
  ai_cost:              num,
  semen_cost:           num,
  embryo_cost:          num,
  implant_fee:          num,
  manual_grazing_cost_override: num,
  disposition:          nullable,
  disposition_date:     orNull,
  disposition_notes:    orNull,
  cause_of_death:       orNull,
  beef_production_flagged_at: orNull,
}

/**
 * PARTIAL BY DESIGN: a key absent from the body leaves that column alone.
 *
 * This used to rebuild the entire row on every call, defaulting each missing
 * field to null / [] / 'active'. Two callers send partial bodies — the grazing
 * cost override on the animal page, and DispositionSheet — so saving either
 * one wiped name, dob, breed, owner_id, dam_id, sire_id, photos, purchase
 * price and all four AI/ET cost fields, and forced status back to 'active'.
 * Marking an animal sold erased the very records Schedule F is built from.
 *
 * Absent and null are NOT the same thing: an explicit null still clears the
 * column, which is how DispositionSheet releases owner_id on a transfer.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  const updateData: Update<'animals'> = {}
  for (const [column, coerce] of Object.entries(PATCH_FIELDS)) {
    if (has(column)) (updateData as Record<string, unknown>)[column] = coerce(body[column])
  }

  // `breeds` is the source of truth for breed / breed_percentage whenever it
  // is sent, so those three move together and never disagree.
  if (has('breeds')) {
    const breeds = Array.isArray(body.breeds) ? body.breeds : []
    const first  = breeds[0] as { breed?: string; pct?: number } | undefined
    updateData.breeds           = breeds
    updateData.breed            = first?.breed || body.breed || null
    updateData.breed_percentage = first?.pct   || body.breed_percentage || null
  } else {
    if (has('breed'))            updateData.breed            = body.breed || null
    if (has('breed_percentage')) updateData.breed_percentage = body.breed_percentage || null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No updatable fields in request body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('animals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Leaving the herd ends the grazing, whatever the reason.
  //
  // Shared expenses are pro-rated by grazing_assignments, not animals.status,
  // so an assignment left open keeps billing animal-days for an animal that is
  // gone. DispositionSheet routes deceased and transferred through here rather
  // than through /sell, so this is the choke point that catches both.
  const LEFT_HERD = ['sold', 'deceased', 'transferred', 'harvested']
  if (typeof updateData.status === 'string' && LEFT_HERD.includes(updateData.status)) {
    const endedOn =
      (typeof updateData.disposition_date === 'string' && updateData.disposition_date) ||
      new Date().toISOString().slice(0, 10)

    const { error: grazeErr } = await supabase
      .from('grazing_assignments')
      .update({ end_date: endedOn })
      .eq('animal_id', id)
      .is('end_date', null)

    // Non-fatal: the disposition itself is recorded either way.
    if (grazeErr) console.error('[animals PATCH] failed to close grazing assignment:', grazeErr.message)
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('animals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
