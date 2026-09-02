export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * How many forwarded receipts are waiting to be looked at.
 *
 * Feeds the badge in the nav. A receipt is forwarded from a truck and reviewed
 * days later at a desk — the thing that closes that gap is a number sitting in
 * front of you, not a screen you have to remember exists. This queue had one
 * link into it, a ghost button on the Billing page, and it may as well have
 * had none.
 */
export async function GET() {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('inbound_receipts')
    .select('id', { count: 'exact', head: true })
    .is('reviewed_at', null)
    .eq('parse_status', 'parsed')

  if (error) return NextResponse.json({ count: 0 })
  return NextResponse.json({ count: count ?? 0 })
}
