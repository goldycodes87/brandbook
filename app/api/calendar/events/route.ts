export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Everything with a date on it, for one window.
 *
 * Reminders are only part of a ranch calendar. A cow's due date lives on her
 * breeding record, a withdrawal clears on a health event, and a lease runs
 * out on the lease — none of those are reminders, and a calendar that shows
 * only reminders is a to-do list with a grid drawn round it.
 *
 * Read-only and deliberately shallow: enough to render a day and decide
 * whether to open it, not the whole record.
 */

/**
 * `calving` is the day she is due. `calving_watch` is the reminder raised a
 * fortnight earlier to start watching her.
 *
 * They are two different things and the calendar has to say so. Left as one
 * kind, every bred cow appeared twice a fortnight apart with near-identical
 * labels, which reads as a bug in the data rather than the deliberate lead
 * time it is.
 */
export type CalendarEventKind =
  'calving' | 'calving_watch' | 'preg_check' | 'reminder' | 'withdrawal' | 'lease'

export interface RanchEvent {
  id: string
  kind: CalendarEventKind
  date: string
  title: string
  /** Ear tag, when the event is about one animal. */
  tag: string | null
  animal_id: string | null
  href: string | null
}

export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams
  const start = sp.get('start')
  const end   = sp.get('end')
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: 'start and end are required, YYYY-MM-DD' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const [remRes, calvingRes, withdrawalRes, leaseRes] = await Promise.all([
    supabase
      .from('reminders')
      .select('id, title, due_date, reminder_type, animal_id, animals(tag_number, name)')
      .eq('is_dismissed', false)
      .gte('due_date', start).lte('due_date', end),

    // The due date lives on the breeding, and is cleared when a recheck comes
    // up open — so a cow that lost her pregnancy drops off the calendar
    // without anybody tidying up after her.
    supabase
      .from('reproduction_events')
      .select('id, expected_calving_date, animal_id, animals(tag_number, name, status)')
      .not('expected_calving_date', 'is', null)
      .gte('expected_calving_date', start).lte('expected_calving_date', end),

    supabase
      .from('health_events')
      .select('id, withdrawal_clear_date, drug_name, animal_id, animals(tag_number, name)')
      .not('withdrawal_clear_date', 'is', null)
      .gte('withdrawal_clear_date', start).lte('withdrawal_clear_date', end),

    supabase
      .from('leases')
      .select('id, property_name, end_date')
      .not('end_date', 'is', null)
      .gte('end_date', start).lte('end_date', end),
  ])

  // Via `unknown`: PostgREST models each to-one animals join as an array.
  type Joined = { tag_number: string; name: string | null; status?: string } | null
  const label = (a: Joined) => (a ? `#${a.tag_number}${a.name ? ` ${a.name}` : ''}` : null)

  const events: RanchEvent[] = []

  for (const r of (remRes.data ?? []) as unknown as Array<{
    id: string; title: string | null; due_date: string; reminder_type: string | null
    animal_id: string | null; animals: Joined
  }>) {
    const isWatch = r.reminder_type === 'calving'
    events.push({
      id:    `rem:${r.id}`,
      kind:  isWatch ? 'calving_watch'
           : r.reminder_type === 'preg_check' ? 'preg_check' : 'reminder',
      date:  r.due_date,
      // Older reminders were titled "Calving due", which they are not — they
      // land fourteen days before she is due. Retitled on the way out rather
      // than rewritten in the table, which would lose what was actually saved.
      title: isWatch ? 'Start calving watch'
           : r.title || r.reminder_type?.replace(/_/g, ' ') || 'Reminder',
      tag:   label(r.animals),
      animal_id: r.animal_id,
      href:  r.animal_id ? `/animals/${r.animal_id}` : '/reproduction',
    })
  }

  for (const c of (calvingRes.data ?? []) as unknown as Array<{
    id: string; expected_calving_date: string; animal_id: string | null; animals: Joined
  }>) {
    // A sold or dead cow is not calving here.
    if (c.animals?.status && c.animals.status !== 'active') continue
    events.push({
      id:    `calv:${c.id}`,
      kind:  'calving',
      date:  c.expected_calving_date,
      title: 'Due to calve',
      tag:   label(c.animals),
      animal_id: c.animal_id,
      href:  c.animal_id ? `/animals/${c.animal_id}` : '/reproduction',
    })
  }

  for (const h of (withdrawalRes.data ?? []) as unknown as Array<{
    id: string; withdrawal_clear_date: string; drug_name: string | null
    animal_id: string | null; animals: Joined
  }>) {
    events.push({
      id:    `wd:${h.id}`,
      kind:  'withdrawal',
      date:  h.withdrawal_clear_date,
      title: `${h.drug_name ?? 'Treatment'} clears`,
      tag:   label(h.animals),
      animal_id: h.animal_id,
      href:  h.animal_id ? `/animals/${h.animal_id}` : '/health',
    })
  }

  for (const l of (leaseRes.data ?? []) as Array<{ id: string; property_name: string; end_date: string }>) {
    events.push({
      id: `lease:${l.id}`, kind: 'lease', date: l.end_date,
      title: `${l.property_name} lease ends`, tag: null, animal_id: null,
      href: `/leases/${l.id}`,
    })
  }

  // A calving reminder and the breeding it came from are the same fact twice.
  const seen = new Set<string>()
  const deduped = events.filter(e => {
    if (e.kind !== 'calving') return true
    const key = `${e.date}|${e.animal_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  deduped.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

  return NextResponse.json({ data: deduped })
}
