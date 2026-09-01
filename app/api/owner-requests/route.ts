export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Update } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  const { data: requests, error } = await supabase
    .from('owner_requests')
    .select('id, owner_id, request_type, status, quantity, animal_type, budget_min, budget_max, breed, timeframe, animal_id, sell_reason, sell_timeline, funds_disposition, funds_other_notes, notes, rancher_notes, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with owner info
  const ownerIds = [...new Set((requests ?? []).map(r => r.owner_id))]
  let ownerMap: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('grazing_owners')
      .select('id, name, owner_name, company_name')
      .in('id', ownerIds)
    for (const o of owners ?? []) {
      ownerMap[o.id] = o.company_name || o.owner_name || o.name || 'Owner'
    }
  }

  // Enrich with animal info where animal_id is set
  const animalIds = (requests ?? []).filter(r => r.animal_id).map(r => r.animal_id as string)
  let animalMap: Record<string, { tag_number: string; name: string | null }> = {}
  if (animalIds.length > 0) {
    const { data: animals } = await supabase
      .from('animals')
      .select('id, tag_number, name')
      .in('id', animalIds)
    for (const a of animals ?? []) {
      animalMap[a.id] = { tag_number: a.tag_number, name: a.name }
    }
  }

  const enriched = (requests ?? []).map(r => ({
    ...r,
    owner_name: ownerMap[r.owner_id] ?? 'Owner',
    animal: r.animal_id ? (animalMap[r.animal_id] ?? null) : null,
  }))

  return NextResponse.json({ data: enriched })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  }

  const validStatuses = ['pending', 'reviewed', 'completed', 'declined']
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const update: Update<'owner_requests'> = { status: body.status }
  if (body.rancher_notes !== undefined) update.rancher_notes = body.rancher_notes

  const { data, error } = await supabase
    .from('owner_requests')
    .update(update)
    .eq('id', body.id)
    .select('id, status, rancher_notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
