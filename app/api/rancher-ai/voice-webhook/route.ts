export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TOOLS_BY_NAME } from '@/lib/rancher-ai/tools'

/**
 * Where Vapi reaches in during a call.
 *
 * Public to the internet, because Vapi's servers call it and they do not carry
 * our session cookie. A shared secret is therefore the entire door: without
 * VAPI_WEBHOOK_SECRET set, this route refuses every request rather than
 * running herd queries for whoever finds the URL.
 *
 * Two things arrive here:
 *   tool-calls          — run a tool, hand back the result, mid-conversation
 *   end-of-call-report  — the transcript, once the call is over
 *
 * Vapi has shipped more than one envelope shape for tool calls over its life,
 * so the parser below accepts the ones seen in the wild and records what it
 * actually got when it recognises none of them. Better a logged shape to fix
 * than a silent 200 that makes the assistant look stupid on a call.
 */

interface ParsedCall { id: string; name: string; args: Record<string, unknown> }

function parseToolCalls(payload: Record<string, unknown>): ParsedCall[] {
  const msg = (payload.message ?? payload) as Record<string, unknown>
  const list =
    (msg.toolCallList as unknown[]) ??
    (msg.toolCalls as unknown[]) ??
    (msg.tool_calls as unknown[]) ??
    []

  const out: ParsedCall[] = []
  for (const raw of list) {
    const c = raw as Record<string, unknown>
    const fn = (c.function ?? {}) as Record<string, unknown>
    const name = (c.name as string) ?? (fn.name as string)
    if (!name) continue

    const rawArgs = c.arguments ?? fn.arguments ?? c.parameters ?? {}
    let args: Record<string, unknown> = {}
    if (typeof rawArgs === 'string') {
      try { args = JSON.parse(rawArgs) } catch { args = {} }
    } else if (rawArgs && typeof rawArgs === 'object') {
      args = rawArgs as Record<string, unknown>
    }

    out.push({ id: (c.id as string) ?? (c.toolCallId as string) ?? name, name, args })
  }
  return out
}

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
  const expected = process.env.VAPI_WEBHOOK_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'Voice is not configured' }, { status: 503 })
  }
  // Vapi sends whatever custom header the assistant's server config names;
  // both spellings are accepted so the dashboard can use either.
  const presented = req.headers.get('x-vapi-secret') ?? req.headers.get('x-vapi-signature')
  if (presented !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => ({})) as Record<string, unknown>
  const msg = (payload.message ?? payload) as Record<string, unknown>
  const type = (msg.type as string) ?? (payload.type as string) ?? ''

  const supabase = createAdminClient()

  // ── A tool, mid-call ────────────────────────────────────────────────────────
  if (type === 'tool-calls' || type === 'function-call') {
    const calls = parseToolCalls(payload)
    if (calls.length === 0) {
      // Recorded rather than swallowed: an envelope we cannot read is a bug we
      // need the shape of.
      console.error('[voice-webhook] unrecognised tool-call envelope', JSON.stringify(msg).slice(0, 2000))
      return NextResponse.json({ results: [] })
    }

    const { data: ranchRow } = await supabase
      .from('ranch_settings').select('id, timezone').limit(1).maybeSingle()
    const ranch = ranchRow as { id: string; timezone: string | null } | null
    const today = todayIn(ranch?.timezone || 'America/Denver')

    const results = []
    for (const call of calls) {
      const tool = TOOLS_BY_NAME.get(call.name)
      if (!tool) {
        results.push({ toolCallId: call.id, result: JSON.stringify({ error: `No tool called ${call.name}` }) })
        continue
      }
      try {
        const result = await tool.run(call.args, {
          ranchId: ranch?.id ?? null,
          // A voice call has no signed-in user at this point; the write tools
          // only propose, so nothing is attributed from here.
          authUserId: 'voice',
          today,
        })
        results.push({ toolCallId: call.id, result: JSON.stringify(result) })
      } catch (e) {
        results.push({
          toolCallId: call.id,
          result: JSON.stringify({ error: e instanceof Error ? e.message : 'That lookup failed.' }),
        })
      }
    }

    return NextResponse.json({ results })
  }

  // ── The call ended ──────────────────────────────────────────────────────────
  if (type === 'end-of-call-report') {
    const call = (msg.call ?? payload.call ?? {}) as Record<string, unknown>
    const metadata = (call.metadata ?? {}) as Record<string, unknown>
    const conversationId = metadata.conversation_id as string | undefined
    const transcript = (msg.transcript as string) ?? (payload.transcript as string) ?? ''

    if (conversationId && transcript.trim()) {
      // Stored as one turn rather than parsed apart. Vapi's transcript is a
      // flat string, and inventing speaker boundaries from it would put words
      // in somebody's mouth in a record that is meant to be evidence.
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: transcript.trim(),
        channel: 'voice',
      })
      await supabase.from('ai_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
