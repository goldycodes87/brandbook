export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Fetch messages ordered asc
  const { data: messages, error } = await supabase
    .from('owner_messages')
    .select('id, direction, body, read_at, created_at')
    .eq('owner_id', session.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark rancher_to_owner messages as read
  const unreadIds = (messages ?? [])
    .filter(m => m.direction === 'rancher_to_owner' && !m.read_at)
    .map(m => m.id)

  if (unreadIds.length > 0) {
    await supabase
      .from('owner_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
  }

  return NextResponse.json({ data: messages ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('owner_messages')
    .insert({
      owner_id: session.id,
      direction: 'owner_to_rancher',
      body: body.body.trim(),
    })
    .select('id, direction, body, read_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
