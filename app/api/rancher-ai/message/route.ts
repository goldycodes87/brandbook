export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import { runAgentTurn, buildSystemPrompt } from '@/lib/rancher-ai/agent'
import { loadMemory, renderMemory, extractMemory } from '@/lib/rancher-ai/memory'
import type { Json } from '@/lib/database.types'

/**
 * One turn of a conversation with RancherAI.
 *
 * Restricted to operators — canConfigure. RancherAI reads across the whole herd
 * and every owner's money, which is exactly what an owner portal must never do.
 * A per-owner version would need its own tool set, scoped to that owner.
 */

/** Today where the cattle are, not where the server is. */
function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const channel = body.channel === 'voice' ? 'voice' : 'text'
  if (!content) return NextResponse.json({ error: 'Say something first' }, { status: 400 })

  const supabase = createAdminClient()

  // ── The conversation ────────────────────────────────────────────────────────
  let conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null

  if (conversationId) {
    const { data } = await supabase
      .from('ai_conversations').select('id, auth_user_id').eq('id', conversationId).maybeSingle()
    const row = data as { id: string; auth_user_id: string | null } | null
    // Somebody else's thread is not found, not forbidden.
    if (!row || row.auth_user_id !== session.authUserId) conversationId = null
  }

  if (!conversationId) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        ranch_id: session.ranchId,
        auth_user_id: session.authUserId,
        // The opening line is the title until something better exists.
        title: content.slice(0, 80),
      })
      .select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    conversationId = (data as { id: string }).id
  }

  // ── What the ranch looks like today ─────────────────────────────────────────
  const [{ data: ranchRow }, { count: headCount }, { data: ownerRows }] = await Promise.all([
    supabase.from('ranch_settings').select('ranch_name, owner_name, timezone').limit(1).maybeSingle(),
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('grazing_owners').select('name, company_name, owner_name').eq('is_self', false),
  ])

  const ranch = (ranchRow ?? {}) as { ranch_name?: string; owner_name?: string; timezone?: string }
  const timezone = ranch.timezone || 'America/Denver'
  const today = todayIn(timezone)

  const owners = ((ownerRows ?? []) as Array<{ name: string | null; company_name: string | null; owner_name: string | null }>)
    .map(o => o.company_name || o.owner_name || o.name || '')
    .filter(Boolean)

  // What it learned in earlier conversations, distilled. Not the old
  // transcripts — those get long, and burying one durable fact under fifty
  // forgettable ones is how an assistant stops noticing the durable one.
  const memory = await loadMemory(session.ranchId, session.authUserId)

  const systemPrompt = buildSystemPrompt({
    ranchName: ranch.ranch_name || 'this ranch',
    ownerName: ranch.owner_name ?? null,
    today,
    timezone,
    headCount: headCount ?? 0,
    owners,
    speaking: session.name,
  }) + renderMemory(memory)

  // ── History ─────────────────────────────────────────────────────────────────
  const { data: priorRows } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20)

  const history: Anthropic.MessageParam[] = ((priorRows ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .filter(m => m.content.trim().length > 0)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  history.push({ role: 'user', content })

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId, role: 'user', content, channel,
  })

  // ── The turn ────────────────────────────────────────────────────────────────
  let turn
  try {
    turn = await runAgentTurn({
      systemPrompt,
      history,
      ctx: { ranchId: session.ranchId, authUserId: session.authUserId, today },
      // A web search takes longer than somebody standing at a chute will wait.
      allowWebSearch: channel !== 'voice',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'RancherAI could not answer that.'
    return NextResponse.json({ error: message, conversation_id: conversationId }, { status: 502 })
  }

  await Promise.all([
    supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: turn.reply,
      tool_calls: turn.toolCalls.length ? (turn.toolCalls as unknown as Json) : null,
      channel,
    }),
    supabase.from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId),
  ])

  // Distilled every few turns, not every turn: it costs a model call, and two
  // messages rarely contain a durable fact. Deliberately not awaited — a slow
  // extraction must never make somebody wait for an answer they already have.
  const { count: messageCount } = await supabase
    .from('ai_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)

  if ((messageCount ?? 0) % 6 === 0) {
    void extractMemory({
      conversationId,
      ranchId: session.ranchId,
      authUserId: session.authUserId,
    }).catch(() => {})
  }

  return NextResponse.json({
    conversation_id: conversationId,
    reply: turn.reply,
    // Named so the UI can render a confirm button rather than parsing prose.
    proposals: turn.proposals,
    // What it looked at. Shown behind a disclosure so an answer about money can
    // be checked without opening the database.
    used: turn.toolCalls.map(c => ({ tool: c.name, input: c.input })),
  })
}
