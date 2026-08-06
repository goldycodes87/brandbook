export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerSession } from '@/lib/owner-auth'

export async function POST(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const year = Number(body.year ?? new Date().getFullYear())

  // Delegate PDF generation to the existing admin route, scoped to the session owner
  const adminUrl = new URL(`/api/grazing-owners/${session.id}/annual-report`, req.url)
  const adminRes = await fetch(adminUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year }),
  })

  const data = await adminRes.json()
  return NextResponse.json(data, { status: adminRes.status })
}
