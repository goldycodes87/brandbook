export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'
import { buildAllocationReport } from '@/lib/expense-allocation-report'

// GET /api/portals/owner/allocations?year=26&quarter=3
//
// The owner's own share of every expense, pending / invoiced / paid. Same
// module as the operator view, scoped to the session's owner — the portal
// cannot show a number Grant's screen disagrees with.
export async function GET(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams

  const now     = new Date()
  const year    = sp.get('year')    ? Number(sp.get('year'))    : now.getFullYear() % 100
  const quarter = sp.get('quarter') ? Number(sp.get('quarter')) : Math.ceil((now.getMonth() + 1) / 3)

  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'year and quarter must be numbers, quarter 1-4' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // ownerId comes from the session, never the query string.
    const report = await buildAllocationReport(supabase, { quarter, year, ownerId: session.id })
    return NextResponse.json(report)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to build allocation report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
