export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The subscribe URL for the ranch calendar feed.
 *
 * The feed itself has existed since August and was reachable only by knowing
 * the token, which nothing displayed — so it may as well not have shipped.
 * This hands the URL to a signed-in operator so the calendar page can offer it.
 *
 * The token in that URL is the credential: anyone holding it can read reminder
 * titles and dates without signing in, which is the price of a feed a calendar
 * app can fetch. Rotate ranch_settings.calendar_feed_token to revoke it.
 */
export async function GET() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ranch_settings')
    .select('calendar_feed_token')
    .limit(1)
    .maybeSingle()

  const token = (data as { calendar_feed_token: string | null } | null)?.calendar_feed_token
  if (!token) return NextResponse.json({ url: null })

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  return NextResponse.json({ url: `${base}/api/calendar/${token}` })
}
