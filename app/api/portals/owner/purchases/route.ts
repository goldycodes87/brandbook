export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerSession } from '@/lib/owner-auth'
import { buildOwnerPurchases } from '@/lib/owner-purchases'
import { resolvePeriod, withinPeriod, type PeriodKey } from '@/lib/purchase-periods'

/**
 * This owner's purchases, for the period they picked.
 *
 * The rules about what counts as a purchase — the ownership chain, pair
 * pricing, whose seller is whose — live in lib/owner-purchases.ts, because
 * the annual report answers the same question and the two must not be able
 * to disagree. This route is the session check and the period filter.
 */
export async function GET(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const period = resolvePeriod((req.nextUrl.searchParams.get('period') ?? 'all_time') as PeriodKey)

  let rows
  try {
    rows = await buildOwnerPurchases(session.id)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const filtered = rows.filter(r => withinPeriod(r.date, period))
  const priced   = filtered.filter(r => r.cost != null)

  return NextResponse.json({
    data: filtered,
    summary: {
      purchases:     filtered.length,
      head:          filtered.reduce((s, r) => s + r.animal_ids.length, 0),
      total:         priced.reduce((s, r) => s + (r.cost ?? 0), 0),
      missing_price: filtered.length - priced.length,
    },
    period: { key: period.key, label: period.label, start: period.start, end: period.end },
    // Undated purchases fall outside every bounded period. Said out loud so a
    // short list reads as a filter doing its job, not as missing records.
    undated: rows.filter(r => !r.date).length,
  })
}
