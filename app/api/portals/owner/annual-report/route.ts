export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerSession } from '@/lib/owner-auth'
import { generateAnnualReportPdf } from '@/app/api/grazing-owners/[id]/annual-report/route'

export async function POST(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const year = Number(body.year ?? new Date().getFullYear())

  // Call the shared generator directly, always scoped to the session owner.
  // Previously this hopped over HTTP to the admin route, which the API gate
  // in proxy.ts now (correctly) rejects for an owner session.
  try {
    const result = await generateAnnualReportPdf(session.id, year)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
