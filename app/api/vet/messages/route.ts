export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVetSession } from '@/lib/vet-auth'

export async function GET() {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vet_messages')
    .select('*, animal:animal_id ( id, tag_number, name )')
    .eq('vet_invite_id', vet.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark all vet-to-rancher messages as read (from vet's perspective)
  await supabase
    .from('vet_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('vet_invite_id', vet.id)
    .eq('direction', 'rancher_to_vet')
    .is('read_at', null)

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { animal_id, message_body } = body

  if (!message_body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vet_messages')
    .insert({
      vet_invite_id: vet.id,
      animal_id: animal_id || null,
      direction: 'vet_to_rancher',
      body: message_body,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
