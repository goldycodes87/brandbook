export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type GroupType =
  | 'whole_herd'
  | 'cows_only'
  | 'bulls_only'
  | 'heifers_only'
  | 'steers_only'
  | 'calves_only'
  | 'by_ear_tag_color'
  | 'by_lease'
  | 'by_owner'
  | 'custom'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function resolveAnimalIds(
  supabase: ReturnType<typeof createAdminClient>,
  groupType: GroupType,
  groupValue: string | undefined,
  customIds: string[] | undefined,
): Promise<string[]> {
  let query = supabase.from('animals').select('id').eq('status', 'active')

  switch (groupType) {
    case 'whole_herd':
      break
    case 'cows_only':
      query = query.eq('sex', 'cow')
      break
    case 'bulls_only':
      query = query.eq('sex', 'bull')
      break
    case 'heifers_only':
      query = query.eq('sex', 'heifer')
      break
    case 'steers_only':
      query = query.eq('sex', 'steer')
      break
    case 'calves_only':
      query = query.eq('sex', 'calf')
      break
    case 'by_ear_tag_color':
      if (!groupValue) return []
      query = query.eq('ear_tag_color', groupValue)
      break
    case 'by_owner':
      if (!groupValue) return []
      query = query.eq('owner_id', groupValue)
      break
    case 'by_lease': {
      if (!groupValue) return []
      const { data: assignments } = await supabase
        .from('grazing_assignments')
        .select('animal_id')
        .eq('lease_id', groupValue)
        .is('end_date', null)
      return (assignments ?? []).map((a: { animal_id: string }) => a.animal_id)
    }
    case 'custom':
      return customIds ?? []

    default:
      return []
  }

  const { data } = await query
  return (data ?? []).map((a: { id: string }) => a.id)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    group_type,
    group_value,
    group_label,
    custom_animal_ids,
    custom_tag_numbers,
    event_date,
    drug_name,
    dose_amount,
    dose_unit,
    withdrawal_days,
    administered_by,
    notes,
    event_type = 'treatment',
  } = body

  if (!group_type) {
    return NextResponse.json({ error: 'group_type is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Resolve custom tag numbers to IDs if provided
  let resolvedCustomIds = custom_animal_ids
  if (group_type === 'custom' && custom_tag_numbers?.length) {
    const { data: byTag } = await supabase
      .from('animals')
      .select('id')
      .in('tag_number', custom_tag_numbers)
    resolvedCustomIds = (byTag ?? []).map((a: { id: string }) => a.id)
  }

  const animalIds = await resolveAnimalIds(supabase, group_type, group_value, resolvedCustomIds)

  if (!animalIds.length) {
    return NextResponse.json({ error: 'No animals matched the selected group' }, { status: 400 })
  }

  const date = event_date || new Date().toISOString().slice(0, 10)
  const withdrawalClearDate = withdrawal_days
    ? addDays(date, Number(withdrawal_days))
    : null

  const healthRows = animalIds.map((animal_id: string) => ({
    animal_id,
    event_type,
    event_date: date,
    drug_name: drug_name || null,
    dose_amount: dose_amount || null,
    dose_unit: dose_unit || null,
    withdrawal_days: withdrawal_days || null,
    withdrawal_clear_date: withdrawalClearDate,
    administered_by: administered_by || null,
    notes: notes || null,
  }))

  const { error: insertError } = await supabase.from('health_events').insert(healthRows)
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Save batch record
  const { data: batch, error: batchError } = await supabase
    .from('health_event_batches')
    .insert({
      batch_date: date,
      group_type,
      group_label: group_label || group_type,
      animal_count: animalIds.length,
      drug_name: drug_name || null,
      dose_amount: dose_amount || null,
      dose_unit: dose_unit || null,
      withdrawal_days: withdrawal_days || null,
      administered_by: administered_by || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (batchError) {
    // Non-fatal — events were saved; batch record is supplementary
    console.error('[bulk health] batch insert error:', batchError.message)
  }

  return NextResponse.json({ data: batch, animal_count: animalIds.length }, { status: 201 })
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('health_event_batches')
    .select('*')
    .order('batch_date', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
