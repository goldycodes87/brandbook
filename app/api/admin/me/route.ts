export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'

// GET /api/admin/me
//
// What the signed-in operator's role permits. Settings asks this to decide
// whether to show the Admin row at all — the row is hidden for everyone who
// cannot open the section, so nobody is offered a door that will bounce them.
//
// Hiding is a courtesy, not the control: /admin is gated server-side in its
// layout and again per room, so knowing the URL gets an owner nowhere.
export async function GET() {
  const s = await getAdminSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    role:          s.role,
    name:          s.name,
    canConfigure:  s.canConfigure,
    canManageData: s.canManageData,
    canSeeBilling: s.canSeeBilling,
    canReachAdmin: s.canConfigure || s.canSeeBilling,
  })
}
