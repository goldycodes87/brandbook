export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import { buildSystemPrompt } from '@/lib/rancher-ai/agent'
import { RANCHER_TOOLS } from '@/lib/rancher-ai/tools'

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

  const base = buildSystemPrompt({
    ranchName: ranch.ranch_name || 'this ranch',
    ownerName: ranch.owner_name ?? null,
    today: todayIn(timezone),
    timezone,
    headCount: headCount ?? 0,
    owners,
    speaking: session.name,
  })

  // Spoken answers are not written answers. This is appended rather than
  // folded into buildSystemPrompt so the text agent stays unaffected.
  const systemPrompt = `${base}

YOU ARE BEING LISTENED TO, NOT READ
- Answer in one or two sentences. If a list runs past four items, say how many there are and offer to send it to the screen.
- No markdown, no bullet characters, no headings — every character you emit gets spoken aloud.
- Read tag numbers digit by digit: "four two", not "forty-two". A misheard tag is the wrong animal.
- Say dollars plainly: "twelve hundred and fifty" rather than "$1,250.00".
- Before anything gets saved, read the whole thing back and wait for a clear yes. If you hear anything less than a yes, treat it as a no.`

  return NextResponse.json({
    systemPrompt,
    firstMessage: `${session.name.split(' ')[0]}. What do you need?`,
    // The tool schemas Vapi declares to its model. Same names the webhook
    // dispatches on, so the two cannot drift.
    tools: RANCHER_TOOLS.map(t => ({
      type: 'function',
      function: {
        name: t.spec.name,
        description: t.spec.description,
        parameters: t.spec.input_schema,
      },
    })),
    ranchName: ranch.ranch_name || 'this ranch',
    speaking: session.name,
  })
}
