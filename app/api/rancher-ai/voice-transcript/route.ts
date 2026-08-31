export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * The transcript, saved by the browser when a call ends.
 *
 * Belt and braces alongside the end-of-call webhook. The webhook is the piece
 * whose envelope shape varies between Vapi versions and which fails silently
 * on a network the browser never sees; this path is signed in, and it knows
 * the call happened because it was there.
 *
 * Saving twice is the risk, so a turn already stored within the last few
 * minutes is skipped rather than duplicated.
 */

interface Turn { role: string; text: string }

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : ''
  const turns = Array.isArray(body.turns) ? (body.turns as Turn[]) : []

  if (!conversationId) return NextResponse.json({ error: 'Which conversation?' }, { status: 400 })
  if (turns.length === 0) return NextResponse.json({ ok: true, saved: 0 })

  const supabase = createAdminClient()

  const { data: conv } = await supabase
    .from('ai_conversations').select('id, auth_user_id').eq('id', conversationId).maybeSingle()
  const row = conv as { id: string; auth_user_id: string | null } | null
  if (!row || row.auth_user_id !== session.authUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // What the webhook may already have written for this call.
  const since = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data: existingRows } = await supabase
    .from('ai_messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .eq('channel', 'voice')
    .gte('created_at', since)

  const seen = new Set(
    ((existingRows ?? []) as Array<{ content: string }>).map(r => r.content.trim()),
  )

  const clean = turns
    .map(t => ({
      role: t.role === 'assistant' ? 'assistant' : 'user',
      content: typeof t.text === 'string' ? t.text.trim() : '',
    }))
    .filter(t => t.content.length > 0 && !seen.has(t.content))

  if (clean.length === 0) return NextResponse.json({ ok: true, saved: 0 })

  // Stamped a second apart so the transcript reads in the order it was said.
  // Vapi hands back final transcripts faster than a timestamp's resolution.
  const base = Date.now() - clean.length * 1000
  const { error } = await supabase.from('ai_messages').insert(
    clean.map((t, i) => ({
      conversation_id: conversationId,
      role: t.role,
      content: t.content,
      channel: 'voice',
      created_at: new Date(base + i * 1000).toISOString(),
    })),
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  return NextResponse.json({ ok: true, saved: clean.length })
}
