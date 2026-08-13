export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IcsProvider } from '@/lib/calendar/ics'
import type { CalendarEvent } from '@/lib/calendar/types'

type Params = { params: Promise<{ token: string }> }

// GET /api/calendar/[token]
//
// Public by necessity: Google Calendar fetches a subscribed feed with no
// cookies, so this route is in proxy.ts's PUBLIC_API list and the token in the
// path IS the credential. It is a uuid stored on ranch_settings; rotate that
// column to revoke a leaked URL.
//
// Read-only, and only ever exposes reminder titles and dates.
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  if (!token) return new NextResponse('Not found', { status: 404 })

  const supabase = createAdminClient()

  const { data: ranch } = await supabase
    .from('ranch_settings')
    .select('ranch_name, calendar_feed_token')
    .limit(1)
    .maybeSingle()

  // Unknown token looks identical to a missing feed — no oracle for guessing.
  if (!ranch?.calendar_feed_token || ranch.calendar_feed_token !== token) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, title, due_date, notes, reminder_type, created_at, animal_id')
    .or('is_dismissed.is.null,is_dismissed.eq.false')
    .order('due_date', { ascending: true })
    .limit(500)

  const events: CalendarEvent[] = (reminders ?? []).map(r => ({
    id:          r.id,
    title:       r.title || `${r.reminder_type ?? 'Reminder'}`,
    date:        r.due_date,
    description: r.notes ?? null,
    updatedAt:   r.created_at ?? null,
  }))

  const provider = new IcsProvider()
  const body = provider.render(events, `${ranch.ranch_name ?? 'Brand Book'} — Ranch`)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="brandbook.ics"',
      'Cache-Control':       'public, max-age=900',
    },
  })
}
