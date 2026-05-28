export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVetSession } from '@/lib/vet-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { body: noteBody, author_role = 'vet' } = body

  if (!noteBody?.trim()) {
    return NextResponse.json({ error: 'Note body is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify the case belongs to this vet
  const { data: caseData } = await supabase
    .from('vet_cases')
    .select('id')
    .eq('id', id)
    .eq('vet_invite_id', vet.id)
    .maybeSingle()

  if (!caseData) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('case_notes')
    .insert({ case_id: id, author_role, body: noteBody })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update case updated_at
  await supabase.from('vet_cases').update({ updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ data }, { status: 201 })
}
