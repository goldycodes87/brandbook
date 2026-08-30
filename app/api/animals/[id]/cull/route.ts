export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeCullReason } from '@/lib/cull'

type Params = { params: Promise<{ id: string }> }

// POST /api/animals/[id]/cull — add her to the cull list.
//
// Its own endpoint rather than a status change: she stays 'active' and keeps
// counting for head counts, grazing billing and the herd report until she is
// actually disposed of. The timestamp is stamped here rather than sent by the
// client so the record does not depend on a phone's clock at the chute.
export async function POST(req: NextRequest, { params }: Params) {
  const { id }   = await params
  const body     = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  const reason = normalizeCullReason(body?.reason)

  const { data: animal } = await supabase
    .from('animals')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (!animal) return NextResponse.json({ error: 'Animal not found' }, { status: 404 })

  // Flagging an animal that already left the herd would put a row on the list
  // that no screen shows and no disposition can clear.
  if ((animal as { status: string }).status !== 'active') {
    return NextResponse.json(
      { error: 'This animal has already left the herd.' },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('animals')
    .update({ cull_flagged_at: new Date().toISOString(), cull_reason: reason })
    .eq('id', id)
    .select('id, tag_number, cull_flagged_at, cull_reason')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/animals/[id]/cull — take her back off the list.
//
// Clears the reason too. Keeping a stale reason next to a cleared flag reads
// as though she were still marked.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id }   = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('animals')
    .update({ cull_flagged_at: null, cull_reason: null })
    .eq('id', id)
    .select('id, tag_number, cull_flagged_at, cull_reason')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
