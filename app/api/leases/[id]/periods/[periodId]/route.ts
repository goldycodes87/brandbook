export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED = ['start_date', 'end_date', 'head_count', 'notes', 'is_paid', 'paid_date', 'paid_amount', 'animal_ids']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { periodId } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const clean: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (k in body) clean[k] = body[k] === '' ? null : body[k]
  }
  if (clean.head_count != null) clean.head_count = Number(clean.head_count)
  if (clean.paid_amount != null) clean.paid_amount = Number(clean.paid_amount)
  // Derive head_count from animal_ids if both provided
  if (Array.isArray(clean.animal_ids) && !('head_count' in body)) {
    clean.head_count = (clean.animal_ids as string[]).length
  }

  const { data, error } = await supabase
    .from('grazing_periods')
    .update(clean)
    .eq('id', periodId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { periodId } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('grazing_periods').delete().eq('id', periodId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
