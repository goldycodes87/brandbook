export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * How many owner requests are waiting on an answer.
 *
 * Buy and sell only. An access request — "let my partner in" — is a different
 * job with its own screen in Admin, and mixing the two would put a number on
 * the nav that sends you to a page where the thing is not.
 *
 * This count exists because the portal has had working Buy and Sell buttons
 * for weeks with nothing on the operator side reading the table. An owner
 * pressed "I want to sell #41" and it went nowhere anybody would look.
 */
export async function GET() {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('owner_requests')
    .select('id', { count: 'exact', head: true })
    .in('request_type', ['buy', 'sell'])
    .eq('status', 'pending')

  if (error) return NextResponse.json({ count: 0 })
  return NextResponse.json({ count: count ?? 0 })
}
