export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import type { Update } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// Partial by design, like the animals PATCH: only keys actually present in the
// body are written. An absent key is not a null.
const PATCH_FIELDS: Record<string, (v: unknown) => unknown> = {
  brand_name:   v => String(v ?? '').trim() || null,
  generic_name: v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  manufacturer: v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  barcode:      v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  route:        v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  drug_class:   v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  dosage_info:  v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  notes:        v => (typeof v === 'string' && v.trim() ? v.trim() : null),
  withdrawal_days_meat: v => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0),
  withdrawal_days_milk: v => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0),
  is_active:    v => Boolean(v),
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  const update: Update<'drug_library'> = {}
  for (const [column, coerce] of Object.entries(PATCH_FIELDS)) {
    if (has(column)) (update as Record<string, unknown>)[column] = coerce(body[column])
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('drug_library')
    .update(update)
    .eq('id', id)
    .select('id, brand_name, is_active, withdrawal_days_meat, withdrawal_days_milk')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
