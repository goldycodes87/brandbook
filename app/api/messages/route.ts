export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('vet_messages')
    .select('*, animal:animal_id ( id, tag_number, name ), vet:vet_invite_id ( name, practice_name )')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { vet_invite_id, animal_id, message_body } = body

  if (!message_body?.trim()) {
    return NextResponse.json({ error: 'message_body is required' }, { status: 400 })
  }
  if (!vet_invite_id) {
    return NextResponse.json({ error: 'vet_invite_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vet_messages')
    .insert({
      vet_invite_id,
      animal_id: animal_id || null,
      direction: 'rancher_to_vet',
      body: message_body,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
