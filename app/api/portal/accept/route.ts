export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { redeemInvite, portalCookie, membershipsForPerson } from '@/lib/portal-auth'

// POST /api/portal/accept  { token }
//
// Redeem a magic link and become signed in. Public by necessity — the token in
// the body is the credential, which is why it is single-purpose, expiring, and
// revocable at the membership.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: null }))
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const session = await redeemInvite(token)
  if (!session) {
    return NextResponse.json({ error: 'That link is no longer valid.' }, { status: 401 })
  }

  const ranches = await membershipsForPerson(session.personId)

  const res = NextResponse.json({
    ok: true,
    role:       session.role,
    onboarded:  session.onboarded,
    name:       session.displayName,
    // More than one means the ranch switcher is worth showing — the vet case.
    ranches,
  })

  const c = await portalCookie(session.membershipId)
  res.cookies.set(c.name, c.value, c.options)
  return res
}
