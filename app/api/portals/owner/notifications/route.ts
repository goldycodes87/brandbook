export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'
import { NOTIFY_FIELDS, type NotifySettings } from '@/lib/notify-preferences'

/**
 * An owner's own email preferences.
 *
 * Scoped to the signed-in person, never to an id in the request — these are
 * settings, and a settings endpoint that takes whose settings from the caller
 * is a way to turn off somebody else's invoice emails.
 */

export async function GET() {
  const session = await getOwnerSession()
  if (!session?.personId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('portal_people')
    .select(NOTIFY_FIELDS.join(', '))
    .eq('id', session.personId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session?.personId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Partial<NotifySettings>

  // Only the switches, only booleans. Anything else in the body is ignored
  // rather than trusted — this row also holds the address the emails go to.
  const patch: Partial<NotifySettings> = {}
  for (const f of NOTIFY_FIELDS) {
    if (typeof body[f] === 'boolean') patch[f] = body[f] as boolean
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('portal_people')
    .update(patch)
    .eq('id', session.personId)
    .select(NOTIFY_FIELDS.join(', '))
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
