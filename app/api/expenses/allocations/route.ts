export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAllocationReport } from '@/lib/expense-allocation-report'

// GET /api/expenses/allocations?year=26&quarter=3[&owner_id=...]
//
// Every owner's share of every expense in the quarter, each marked
// pending / invoiced / paid. Pending shares are computed live from current
// herd-days; invoiced and paid shares are read back exactly as billed.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const now     = new Date()
  const year    = sp.get('year')    ? Number(sp.get('year'))    : now.getFullYear() % 100
  const quarter = sp.get('quarter') ? Number(sp.get('quarter')) : Math.ceil((now.getMonth() + 1) / 3)
  const ownerId = sp.get('owner_id')

  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: 'quarter must be 1-4' }, { status: 400 })
  }
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: 'year must be a number' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    const report = await buildAllocationReport(supabase, { quarter, year, ownerId })
    return NextResponse.json(report)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to build allocation report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
