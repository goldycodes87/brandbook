export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import type { PortalRole } from '@/lib/portal-auth'
import type { Update } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

const ROLES: PortalRole[] = ['admin', 'co_admin', 'owner', 'cpa', 'vet']

// PATCH — change a role, or revoke a way in.
//
// Revoked rather than deleted: the membership is what a treatment record, an
// invoice or a message points at when it says who did something. Deleting it
// would orphan that history to keep a list tidy.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  const { data: current } = await supabase
    .from('portal_memberships')
    .select('id, role, ranch_id, person_id, status')
    .eq('id', id)
    .maybeSingle()

  const row = current as { id: string; role: PortalRole; ranch_id: string; person_id: string; status: string } | null
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.ranch_id !== s.ranchId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Update<'portal_memberships'> = {}

  if (typeof body.role === 'string') {
    if (!ROLES.includes(body.role as PortalRole)) {
      return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
    }
    // An owner membership needs a herd behind it, which this room cannot
    // attach — the table's own check would reject it anyway.
    if (body.role === 'owner') {
      return NextResponse.json({ error: 'Change owner access from the Owners room' }, { status: 400 })
    }
    update.role = body.role
  }

  if (body.status === 'revoked' || body.status === 'active') {
    update.status = body.status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  // The last admin cannot remove their own way in. Losing the only admin means
  // nobody can invite one back, and the fix is a database console.
  const losingAdmin =
    (row.role === 'admin') &&
    (update.status === 'revoked' || (update.role && update.role !== 'admin'))

  if (losingAdmin) {
    const { count } = await supabase
      .from('portal_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('ranch_id', s.ranchId ?? '')
      .eq('role', 'admin')
      .eq('status', 'active')

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'This is the only admin. Make somebody else an admin first.' },
        { status: 409 },
      )
    }
  }

  const { error } = await supabase.from('portal_memberships').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
