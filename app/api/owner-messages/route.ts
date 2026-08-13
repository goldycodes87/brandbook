export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  // Fetch all owner messages with owner info
  const { data: messages, error } = await supabase
    .from('owner_messages')
    .select('id, owner_id, direction, body, read_at, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get unique owner IDs and fetch owner info
  const ownerIds = [...new Set((messages ?? []).map(m => m.owner_id))]
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

  // Mark owner_to_rancher messages as read
  const unreadIds = (messages ?? [])
    .filter(m => m.direction === 'owner_to_rancher' && !m.read_at)
    .map(m => m.id)
  if (unreadIds.length > 0) {
    await supabase
      .from('owner_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
  }

  // Group by owner
  const threadMap = new Map<string, {
    owner_id: string
    owner_name: string
    messages: typeof messages
    unread_count: number
  }>()

  for (const msg of messages ?? []) {
    if (!threadMap.has(msg.owner_id)) {
      threadMap.set(msg.owner_id, {
        owner_id: msg.owner_id,
        owner_name: ownerMap[msg.owner_id] ?? 'Owner',
        messages: [],
        unread_count: 0,
      })
    }
    const thread = threadMap.get(msg.owner_id)!
    thread.messages.push(msg)
    // Count unread before marking (already counted above, use pre-update state)
    if (msg.direction === 'owner_to_rancher' && !msg.read_at) {
      thread.unread_count++
    }
  }

  const threads = Array.from(threadMap.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]?.created_at ?? ''
    const bLast = b.messages[b.messages.length - 1]?.created_at ?? ''
    return bLast.localeCompare(aLast)
  })

  return NextResponse.json({ data: threads })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.owner_id || !body?.body?.trim()) {
    return NextResponse.json({ error: 'owner_id and body are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('owner_messages')
    .insert({
      owner_id: body.owner_id,
      direction: 'rancher_to_owner',
      body: body.body.trim(),
    })
    .select('id, owner_id, direction, body, read_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
