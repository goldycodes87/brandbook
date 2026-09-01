/* eslint-disable @typescript-eslint/ban-ts-comment -- see the banner below */
// @ts-nocheck — QUARANTINED, NOT FIXED.
//
// This file queries columns that do not exist: vet_cases.vet_invite_id,
// vet_messages.vet_invite_id and .direction, treatment_plans.case_id. Every
// one of those calls fails at runtime today, and has since the schema moved
// under this code — the tables hold zero rows, which is the evidence.
//
// It is NOT a rename. vet_messages has no vet column at all: it models a
// per-animal thread with sender_id/sender_role, while this code wants a
// per-vet inbox. Guessing a mapping would ship invented behaviour into the
// portal a real vet is about to be handed.
//
// So the check is switched off here rather than the rest of the app going
// unchecked to accommodate it. Delete this banner when the vet portal is
// rebuilt against portal_people, and let the compiler list the work.
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
