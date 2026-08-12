export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/animals/[id]/ai-fee  { ai_fee_per_head: number | null }
//
// Deliberately separate from PATCH /api/animals/[id], which rewrites every
// column from its body — sending a single field there would blank the rest of
// the animal record.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body   = await req.json().catch(() => ({}))

  const raw = body?.ai_fee_per_head
  let fee: number | null = null
  if (raw !== null && raw !== undefined && raw !== '') {
    fee = Number(raw)
    if (isNaN(fee) || fee < 0) {
      return NextResponse.json({ error: 'ai_fee_per_head must be a positive number or null' }, { status: 400 })
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('animals')
    .update({ ai_fee_per_head: fee })
    .eq('id', id)
    .select('id, ai_fee_per_head')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
