export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('reproduction_events')
    .select(`
      *,
      animal:animal_id ( id, tag_number, name, ear_tag_color, sex ),
      sire:sire_id ( id, tag_number, name ),
      calf:calf_id ( id, tag_number, name, sex )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const allowed = [
    'event_type', 'event_date', 'sire_id', 'sire_name_text', 'breed_method',
    'conception_method', 'ai_technician', 'expected_calving_date',
    'calving_ease_score', 'preg_check_result', 'preg_check_method',
    'days_bred', 'weaning_date', 'weaning_weight_lbs', 'notes',
  ] as const

  const update: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) update[k] = body[k] ?? null
  }

  const { data, error } = await supabase
    .from('reproduction_events')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('reproduction_events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
