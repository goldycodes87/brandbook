import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * What RancherAI carries from one conversation to the next.
 *
 * The transcript is not the memory. Replaying twenty old messages into every
 * prompt is expensive, gets worse the longer somebody uses the app, and buries
 * the one durable fact under fifty forgettable ones. So conversations get
 * distilled: a short list of things that are still true tomorrow.
 *
 * What counts as durable is deliberately narrow. How the operation runs, what
 * it charges, who does what, what the rancher has corrected. Not what was asked
 * last Tuesday — that is what the transcript is for.
 */

const MODEL = 'claude-sonnet-4-6'

/** Enough to be useful, few enough that the model reads them all. */
const MAX_FACTS = 40

export interface MemoryFact {
  fact: string
  kind: 'ranch' | 'preference' | 'correction'
}

/** The facts to put in front of the model this turn. */
export async function loadMemory(ranchId: string | null, authUserId: string): Promise<MemoryFact[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ai_memory')
    .select('fact, kind, auth_user_id')
    .or(`auth_user_id.is.null,auth_user_id.eq.${authUserId}`)
    .order('updated_at', { ascending: false })
    .limit(MAX_FACTS)

  return ((data ?? []) as Array<{ fact: string; kind: string }>)
    .map(r => ({ fact: r.fact, kind: r.kind as MemoryFact['kind'] }))
}

export function renderMemory(facts: MemoryFact[]): string {
  if (facts.length === 0) return ''

  const corrections = facts.filter(f => f.kind === 'correction')
  const rest        = facts.filter(f => f.kind !== 'correction')

  const lines: string[] = ['', 'WHAT YOU ALREADY KNOW ABOUT THIS OUTFIT']
  for (const f of rest) lines.push(`- ${f.fact}`)

  // Kept separate and last, because a correction is the rancher telling you
  // that you got something wrong. It outranks anything above it.
  if (corrections.length) {
    lines.push('', 'THINGS YOU HAVE BEEN CORRECTED ON — do not repeat these mistakes')
    for (const f of corrections) lines.push(`- ${f.fact}`)
  }

  return lines.join('\n')
}

const EXTRACT_PROMPT = `You are keeping notes for a ranch assistant so it does not have to be told the same thing twice.

Read the conversation. Pull out only what will STILL BE TRUE in a month.

Worth keeping:
- How the operation runs. "Runs a spring calving herd, turns bulls out mid-June."
- What it charges and how. "Charges treatment labour as a flat rate per head, not hourly."
- Who does what. "Spencer does the AI work. Dr. Reyes is the vet and sees a lot of other cattle clients."
- A correction the rancher made. "Told you #77 was sold private treaty, not through the barn."
- A standing preference about how they want answers.

NOT worth keeping:
- Anything a database query already answers: head counts, due dates, balances, tag numbers. Those change, and the assistant looks them up.
- What was asked this time.
- Anything the rancher did not actually say. Do not infer, do not embellish.

Return JSON only, no prose:
{"facts":[{"fact":"...","kind":"ranch|preference|correction"}]}

An empty list is the right answer more often than not. Return {"facts":[]} rather than reaching.`

/**
 * Distil a conversation into facts and store them.
 *
 * Called after a turn and deliberately not awaited — a slow or failed
 * extraction must never make somebody wait for an answer they already have.
 */
export async function extractMemory(opts: {
  conversationId: string
  ranchId: string | null
  authUserId: string
}): Promise<number> {
  const supabase = createAdminClient()

  const { data: rows } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', opts.conversationId)
    .order('created_at', { ascending: false })
    .limit(30)

  const messages = ((rows ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .filter(m => m.content.trim())

  if (messages.length < 2) return 0

  const transcript = messages.map(m => `${m.role === 'user' ? 'Rancher' : 'Assistant'}: ${m.content}`).join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: EXTRACT_PROMPT,
    messages: [{ role: 'user', content: transcript }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim()

  let parsed: { facts?: Array<{ fact?: unknown; kind?: unknown }> }
  try {
    // Tolerate a fenced block, which the model occasionally adds despite being asked not to.
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    return 0
  }

  const KINDS = ['ranch', 'preference', 'correction']
  const facts = (parsed.facts ?? [])
    .map(f => ({
      fact: typeof f.fact === 'string' ? f.fact.trim() : '',
      kind: typeof f.kind === 'string' && KINDS.includes(f.kind) ? f.kind : 'ranch',
    }))
    .filter(f => f.fact.length > 0 && f.fact.length < 300)

  if (facts.length === 0) return 0

  const { error } = await supabase.from('ai_memory').upsert(
    facts.map(f => ({
      ranch_id: opts.ranchId,
      // A preference belongs to the person who stated it. A fact about the
      // operation belongs to everybody who runs it.
      auth_user_id: f.kind === 'preference' ? opts.authUserId : null,
      fact: f.fact,
      kind: f.kind,
      source_conversation_id: opts.conversationId,
      updated_at: new Date().toISOString(),
    })),
    // Matches ai_memory_unique. Learning the same thing twice touches the row
    // rather than adding a second copy.
    { onConflict: 'ranch_id,auth_user_id,fact', ignoreDuplicates: false },
  )

  return error ? 0 : facts.length
}
