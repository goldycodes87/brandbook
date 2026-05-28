export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVetSession } from '@/lib/vet-auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('vet_cases')
    .select('*, animal:animal_id ( id, tag_number, name, breed, sex, dob ), notes:case_notes ( * )')
    .eq('id', id)
    .eq('vet_invite_id', vet.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, title, description } = body

  const supabase = createAdminClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) {
    update.status = status
    if (status === 'resolved') update.resolved_at = new Date().toISOString()
  }
  if (title !== undefined) update.title = title
  if (description !== undefined) update.description = description

  const { data, error } = await supabase
    .from('vet_cases')
    .update(update)
    .eq('id', id)
    .eq('vet_invite_id', vet.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
