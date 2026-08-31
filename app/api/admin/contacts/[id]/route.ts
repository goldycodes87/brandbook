export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

type Params = { params: Promise<{ id: string }> }

// Partial by design: only keys present in the body are written.
const FIELDS: Record<string, (v: unknown) => unknown> = {
  name:    v => String(v ?? '').trim() || null,
  role:    v => (typeof v === 'string' && v.trim() ? v.trim() : 'other'),
  company: v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  phone:   v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  email:   v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  notes:   v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  is_active: v => Boolean(v),
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  for (const [column, coerce] of Object.entries(FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(body, column)) update[column] = coerce(body[column])
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }
  update.updated_at = new Date().toISOString()

  const supabase = createAdminClient()
  const { error } = await supabase.from('ranch_contacts').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
