export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import { buildSystemPrompt } from '@/lib/rancher-ai/agent'
import { RANCHER_TOOLS, confirmLastProposal } from '@/lib/rancher-ai/tools'
import { loadMemory, renderMemory } from '@/lib/rancher-ai/memory'

/**
 * The assistant Vapi should run, built fresh for whoever is calling.
 *
 * Assembled here rather than saved in Vapi's dashboard because the prompt
 * carries today's date, the head count and the owner names — facts that go
 * stale the moment a calf hits the ground. A dashboard-stored assistant would
 * be confidently wrong about the herd by Tuesday.
 *
 * The tools it declares are the same tools the text agent runs. Vapi calls them
 * through /api/rancher-ai/voice-webhook, which executes the same handlers.
 */

function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export async function GET() {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const [{ data: ranchRow }, { count: headCount }, { data: ownerRows }] = await Promise.all([
    supabase.from('ranch_settings').select('ranch_name, owner_name, timezone').limit(1).maybeSingle(),
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('grazing_owners').select('name, company_name, owner_name').eq('is_self', false),
  ])

  const ranch = (ranchRow ?? {}) as { ranch_name?: string; owner_name?: string; timezone?: string }
  const timezone = ranch.timezone || 'America/Denver'

  const owners = ((ownerRows ?? []) as Array<{ name: string | null; company_name: string | null; owner_name: string | null }>)
    .map(o => o.company_name || o.owner_name || o.name || '')
    .filter(Boolean)

  // The same memory the text agent gets. A fact learned by typing should not
  // have to be learned again by speaking.
  const memory = await loadMemory(session.ranchId, session.authUserId)

  const base = buildSystemPrompt({
    ranchName: ranch.ranch_name || 'this ranch',
    ownerName: ranch.owner_name ?? null,
    today: todayIn(timezone),
    timezone,
    headCount: headCount ?? 0,
    owners,
    speaking: session.name,
  }) + renderMemory(memory)

  // Spoken answers are not written answers. This is appended rather than
  // folded into buildSystemPrompt so the text agent stays unaffected.
  const systemPrompt = `${base}

YOU ARE BEING LISTENED TO, NOT READ
- Answer in one or two sentences. If a list runs past four items, say how many there are and offer to send it to the screen.
- No markdown, no bullet characters, no headings — every character you emit gets spoken aloud.
- Read tag numbers digit by digit: "four two", not "forty-two". A misheard tag is the wrong animal.
- Say dollars plainly: "twelve hundred and fifty" rather than "$1,250.00".
- Before anything gets saved, read the whole thing back and wait for a clear yes. If you hear anything less than a yes, treat it as a no.

SAVING SOMETHING BY VOICE
- A propose_ tool does not save. Read its summary back in full, including the withdrawal date or the dollar amount, then ask "do you want me to save that".
- Only on a clear yes, call confirm_last_proposal. "Maybe", "hang on", silence, or a repeated question are all no — say you have left it alone and move on.
- If they change a detail, call the propose_ tool again with the correction. Never confirm a proposal that no longer matches what they just said.`

  // Vapi's own voices need no second vendor — the Vapi key is the only
  // credential. Swap the provider here for 11labs and a voice id if a
  // particular voice is wanted; nothing else has to change.
  const voice = {
    provider: process.env.VAPI_VOICE_PROVIDER || 'vapi',
    voiceId:  process.env.VAPI_VOICE_ID       || 'Elliot',
  }

  return NextResponse.json({
    systemPrompt,
    firstMessage: `${session.name.split(' ')[0]}. What do you need?`,
    voice,
    // Nova-3 handles wind and a running engine better than the default, which
    // is the condition this gets used in.
    transcriber: { provider: 'deepgram', model: 'nova-3', language: 'en-US' },
    // Every tool the text agent has, plus the one that only makes sense on a
    // call: there is no button to tap, so a spoken yes needs somewhere to land.
    tools: [...RANCHER_TOOLS, confirmLastProposal].map(t => ({
      type: 'function',
      function: {
        name: t.spec.name,
        description: t.spec.description,
        parameters: t.spec.input_schema,
      },
    })),
    ranchName: ranch.ranch_name || 'this ranch',
    speaking: session.name,
    // Handed to Vapi as call metadata and read back by the webhook. Without
    // these the call cannot write anything or save its transcript.
    authUserId: session.authUserId,
  })
}
