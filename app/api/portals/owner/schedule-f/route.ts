export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerSession } from '@/lib/owner-auth'

/**
 * This owner's Schedule F figures, for their accountant.
 *
 * A thin wrapper on the operator report, which already does the work and
 * already takes an owner. The only thing added here is that the owner is the
 * session's own and cannot be asked for: the operator route reads owner_id
 * from the query string, which is right behind an operator login and would be
 * a way to read another man's books from behind a portal one.
 *
 * Called in-process rather than over HTTP because the API gate in proxy.ts
 * correctly refuses an operator route to a portal session — the same reason
 * the annual report is wired this way.
 */
export async function GET(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const year = yearParam && /^\d{4}$/.test(yearParam)
    ? yearParam
    : String(new Date().getFullYear())

  const { GET: operatorScheduleF } = await import('@/app/api/reports/schedule-f/route')

  const url = new URL(req.url)
  url.searchParams.set('owner_id', session.id)
  url.searchParams.set('year', year)

  // A fresh Request so nothing from the caller's — headers, cookies, any other
  // query parameter — reaches the operator handler alongside the owner id.
  return operatorScheduleF(new NextRequest(url, { method: 'GET' }))
}
