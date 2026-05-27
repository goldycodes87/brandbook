export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: 'Expected non-empty array of weight objects' }, { status: 400 })
  }

  const rows = body.map((w: { weight_lbs: number; weighed_at?: string; notes?: string; source?: string }) => ({
    weight_lbs:  w.weight_lbs,
    weighed_at:  w.weighed_at ?? new Date().toISOString(),
    notes:       w.notes ?? null,
    source:      w.source ?? 'gallagher_csv',
    animal_id:   id,
  }))

  const { data, error } = await supabase
    .from('weights')
    .insert(rows)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ inserted: data.length }, { status: 201 })
}
