export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Update } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const upcoming = sp.get('upcoming')
  const days     = Number(sp.get('days') ?? 30)
  const supabase = createAdminClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // The breeding behind the reminder rides along. A preg check logged without
  // it cannot work out an expected calving date, and silently skips creating
  // the calving reminder.
  let query = supabase
    .from('reminders')
    .select(`*,
      animal:animal_id ( id, tag_number, ear_tag_color, name, sex, owner_id ),
      reproduction_event:reproduction_event_id (
        id, event_date, expected_calving_date, sire_name_text,
        sire_library:sire_library_id ( bull_name )
      )`)
    .order('due_date', { ascending: true })

  if (upcoming === 'true') {
    query = query.eq('is_dismissed', false).lte('due_date', cutoffStr)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { animal_id, reminder_type, due_date, title, notes, protocol_group_id, reproduction_event_id } = body
  if (!due_date) return NextResponse.json({ error: 'due_date required' }, { status: 400 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      animal_id:              animal_id              || null,
      reminder_type:          reminder_type          || null,
      due_date,
      title:                  title                  || null,
      notes:                  notes                  || null,
      protocol_group_id:      protocol_group_id      || null,
      reproduction_event_id:  reproduction_event_id  || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// Dismiss by id, or — when the caller reached the animal directly rather than
// through its reminder — by animal + type. Logging a preg check from the animal
// page used to leave the reminder standing, so the same cow came up again on
// the next screen.
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, animal_id, reminder_type, is_dismissed } = body

  if (!id && !(animal_id && reminder_type)) {
    return NextResponse.json(
      { error: 'id, or animal_id + reminder_type, required' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const update: Update<'reminders'> = {}
  if (is_dismissed !== undefined) {
    update.is_dismissed = Boolean(is_dismissed)
    update.dismissed_at = is_dismissed ? new Date().toISOString() : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  if (id) {
    const { data, error } = await supabase
      .from('reminders')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // Only open reminders — never resurrect or re-stamp a dismissed one.
  const { data, error } = await supabase
    .from('reminders')
    .update(update)
    .eq('animal_id', animal_id)
    .eq('reminder_type', reminder_type)
    .eq('is_dismissed', false)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], dismissed: (data ?? []).length })
}
