export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVetSession } from '@/lib/vet-auth'

export async function GET() {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vet_cases')
    .select('id, title, status, description, created_at, updated_at, animal:animal_id ( id, tag_number, name )')
    .eq('vet_invite_id', vet.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { animal_id, title, description } = body

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vet_cases')
    .insert({
      animal_id: animal_id || null,
      vet_invite_id: vet.id,
      title,
      description: description || null,
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
