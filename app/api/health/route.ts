export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTreatmentLabor } from '@/lib/treatment-labor'
import { asHealthEventType } from '@/lib/db-enums'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl

  const animal_id     = searchParams.get('animal_id')
  const event_type    = searchParams.get('event_type')
  const date_from     = searchParams.get('date_from')
  const date_to       = searchParams.get('date_to')
  const in_withdrawal = searchParams.get('in_withdrawal')

  let query = supabase
    .from('health_events')
    .select(`
      *,
      animal:animal_id ( id, tag_number, name, ear_tag_color )
    `)
    .order('event_date', { ascending: false })

  if (animal_id)   query = query.eq('animal_id', animal_id)
  const healthType = asHealthEventType(event_type)
  if (healthType) query = query.eq('event_type', healthType)
  if (date_from)   query = query.gte('event_date', date_from)
  if (date_to)     query = query.lte('event_date', date_to)
  if (in_withdrawal === 'true') {
    query = query
      .not('withdrawal_clear_date', 'is', null)
      .gte('withdrawal_clear_date', new Date().toISOString().slice(0, 10))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const eventDate = body.event_date || new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('health_events')
    .insert({
      animal_id:       body.animal_id,
      event_type:      body.event_type,
      event_date:      eventDate,
      drug_name:       body.drug_name       || null,
      dose_amount:     body.dose_amount     || null,
      dose_unit:       body.dose_unit       || null,
      withdrawal_days: body.withdrawal_days || null,
      bcs_score:       body.bcs_score       || null,
      administered_by: body.administered_by || null,
      notes:           body.notes           || null,
      // Who prescribed it and who physically gave it. The second is a billing
      // switch, not a label — see lib/treatment-labor.ts.
      prescribed_by_person_id:   body.prescribed_by_person_id   || null,
      administered_by_role:      body.administered_by_role      || null,
      administered_by_person_id: body.administered_by_person_id || null,
      // 'label' when the days came from drug_library, 'override' when a human
      // changed them. Without this an override looks like a lookup.
      withdrawal_source:         body.withdrawal_source         || null,
      signed_at:                 body.signed_at                 || null,
      signature_url:             body.signature_url             || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const event = data as { id: string; animal_id: string; drug_name: string | null }

  // Non-fatal: the treatment is recorded either way, and a missing labour line
  // is a billing correction rather than a lost medical record.
  const labor = await syncTreatmentLabor(supabase, {
    healthEventId:      event.id,
    animalId:           event.animal_id,
    eventDate,
    drugName:           event.drug_name,
    administeredByRole: body.administered_by_role ?? null,
    existingExpenseId:  null,
  })

  if (labor.expenseId) {
    await supabase.from('health_events')
      .update({ labor_expense_id: labor.expenseId })
      .eq('id', event.id)
  }

  return NextResponse.json({ data, labor }, { status: 201 })
}
