export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * Pick the thread back up.
 *
 * A conversation that vanishes when the app is closed is not a conversation,
 * it is a search box. Reopening returns the most recent thread if it is recent
 * enough to still be the same train of thought, and starts a fresh one if it
 * is not — coming back the next morning should not mean arguing with
 * yesterday's context.
 */

/** Past this, yesterday's thread is history rather than the conversation you are in. */
const RESUME_WINDOW_HOURS = 12

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const wanted = req.nextUrl.searchParams.get('id')

  interface Conversation { id: string; title: string | null; last_message_at: string }
  let conversation: Conversation | null = null

  if (wanted) {
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, title, last_message_at, auth_user_id')
      .eq('id', wanted)
      .maybeSingle()
    const row = data as unknown as (Conversation & { auth_user_id: string | null }) | null
    // Somebody else's thread is not found, not forbidden.
    if (row && row.auth_user_id === session.authUserId) conversation = row
  } else {
    const cutoff = new Date(Date.now() - RESUME_WINDOW_HOURS * 3600_000).toISOString()
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, title, last_message_at')
      .eq('auth_user_id', session.authUserId)
      .gte('last_message_at', cutoff)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    conversation = data as unknown as Conversation | null
  }

  if (!conversation) return NextResponse.json({ conversation: null, messages: [] })

  const { data: messageRows } = await supabase
    .from('ai_messages')
    .select('role, content, tool_calls, channel, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at')
    .limit(60)

  const messages = ((messageRows ?? []) as Array<{
    role: string; content: string; tool_calls: unknown; channel: string
  }>)
    .filter(m => m.content.trim())
    .map(m => ({
      role: m.role,
      content: m.content,
      channel: m.channel,
      // Only the names and inputs come back. A stored tool result can be large,
      // and the screen only ever showed what was checked, not what came back.
      used: Array.isArray(m.tool_calls)
        ? (m.tool_calls as Array<{ name: string; input: unknown }>).map(c => ({ tool: c.name, input: c.input }))
        : [],
    }))

  return NextResponse.json({ conversation, messages })
}

// POST — open an empty thread.
//
// Voice needs one before it starts talking: the webhook cannot create a thread
// mid-sentence, and a proposal with nowhere to park is a proposal that can
// never be confirmed. Kept separate from /message so opening a call does not
// cost a full agent turn or put "starting a voice call" in the transcript.
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      ranch_id: session.ranchId,
      auth_user_id: session.authUserId,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'Voice call',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversation_id: (data as unknown as { id: string }).id }, { status: 201 })
}

// DELETE — start over. The thread is kept; it just stops being the current one.
export async function DELETE(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which conversation?' }, { status: 400 })

  const supabase = createAdminClient()
  // Dated back out of the resume window rather than deleted. The transcript is
  // the evidence behind anything RancherAI created, and a tidy-up gesture
  // should not destroy that.
  const { error } = await supabase
    .from('ai_conversations')
    .update({ last_message_at: new Date(0).toISOString() })
    .eq('id', id)
    .eq('auth_user_id', session.authUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
