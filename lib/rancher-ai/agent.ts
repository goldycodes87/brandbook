import Anthropic from '@anthropic-ai/sdk'
import { RANCHER_TOOLS, TOOLS_BY_NAME, type ToolContext } from './tools'

/**
 * The loop. Ask Claude, run whatever tools it asks for, ask again, until it
 * stops asking — then hand back the answer and a record of everything it did.
 *
 * Written by hand rather than with the SDK's tool runner for one reason: every
 * tool call and result has to come back to the caller so it can be stored
 * beside the reply. An answer about what somebody owes has to be auditable a
 * year later, and "the model said so" is not an audit trail.
 */

const MODEL = 'claude-opus-5'

/** A hard stop. Ten rounds is far more than any real question needs; a loop that
 *  reaches it is malfunctioning, not working hard. */
const MAX_ROUNDS = 10

export interface TurnRecord {
  name: string
  input: unknown
  result: unknown
}

export interface AgentTurn {
  reply: string
  toolCalls: TurnRecord[]
  /** Set when a write tool produced something for the rancher to confirm. */
  proposals: Array<{ action: string; summary: string; payload: Record<string, unknown> }>
  stoppedEarly: boolean
}

export interface RanchFacts {
  ranchName: string
  ownerName: string | null
  today: string
  timezone: string
  headCount: number
  owners: string[]
  speaking: string
}

export function buildSystemPrompt(f: RanchFacts): string {
  return `You are RancherAI, the assistant inside BrandBook — the record system for ${f.ranchName}.

You are talking to ${f.speaking}. Today is ${f.today} (${f.timezone}).

THE OPERATION RIGHT NOW
- ${f.headCount} head on the ground.
- Cattle owners with animals here: ${f.owners.length ? f.owners.join(', ') : 'none besides the home ranch'}.

HOW TO ANSWER
- Talk like a hand who knows the place, not a chatbot. Short sentences. No preamble, no "Great question", no offering to help further.
- Numbers come from tools. Never estimate a count, a dollar figure, a due date or a phone number — call the tool and read what it says.
- If a tool comes back empty, say so plainly. Do not fill the gap.
- If a tool hands back several candidates because a name was ambiguous, ask which one. Do not pick.
- Cattle are "#42" or "#42 (Ruby)". Money is to the cent. Dates are "May 14" in conversation, never an ISO timestamp.
- When you are asked what something costs or what somebody owes, say what is already invoiced and what is still pending separately. Pending can still move.

DOING THINGS
- The propose_ tools do not save anything. They hand back a proposal that ${f.speaking} confirms first.
- After calling one, state the proposal back in one line and ask for a yes. Do not claim anything was recorded, saved or set — it has not been.
- Say the consequence out loud before asking. A treatment sets a withdrawal date; a herd expense lands on other people's bills.

RESEARCH
- For a bull, search the sire library first. What is already imported is probably who they mean.
- Use web search for outside facts — a bull's EPDs at a stud, a drug label, market prices. Say where a fact came from.
- Never present something off the web as if it were a record from this ranch.

WHAT YOU DO NOT DO
- You do not give veterinary or financial advice. You report what the records say and what a label says. A dosing question goes to the vet, and you say so.
- You do not guess at withdrawal times. That number comes off the drug library.`
}

export async function runAgentTurn(opts: {
  systemPrompt: string
  history: Anthropic.MessageParam[]
  ctx: ToolContext
  /** Off for voice, where a web search takes longer than a person will wait. */
  allowWebSearch?: boolean
}): Promise<AgentTurn> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const tools: Anthropic.ToolUnion[] = RANCHER_TOOLS.map(t => t.spec)
  if (opts.allowWebSearch !== false) {
    tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 5 } as unknown as Anthropic.ToolUnion)
  }

  const messages: Anthropic.MessageParam[] = [...opts.history]
  const toolCalls: TurnRecord[] = []
  const proposals: AgentTurn['proposals'] = []
  let stoppedEarly = false

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: opts.systemPrompt,
      tools,
      messages,
    })

    if (response.stop_reason !== 'tool_use') {
      return { reply: textOf(response), toolCalls, proposals, stoppedEarly }
    }

    messages.push({ role: 'assistant', content: response.content })

    // Server tools (web search) run on Anthropic's side and come back already
    // answered; only our own tools need results sent up.
    const requests = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && TOOLS_BY_NAME.has(b.name),
    )

    if (requests.length === 0) {
      return { reply: textOf(response), toolCalls, proposals, stoppedEarly }
    }

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const req of requests) {
      const tool = TOOLS_BY_NAME.get(req.name)!
      let result: unknown
      try {
        result = await tool.run((req.input ?? {}) as Record<string, unknown>, opts.ctx)
      } catch (e) {
        // Handed back to the model rather than thrown: a tool that failed is
        // something it can tell the rancher about, and a 500 is not.
        result = { error: e instanceof Error ? e.message : 'That lookup failed.' }
      }

      toolCalls.push({ name: req.name, input: req.input, result })

      const asRecord = result as { proposal?: AgentTurn['proposals'][number] }
      if (asRecord?.proposal) proposals.push(asRecord.proposal)

      results.push({
        type: 'tool_result',
        tool_use_id: req.id,
        content: JSON.stringify(result),
      })
    }

    messages.push({ role: 'user', content: results })
  }

  stoppedEarly = true
  return {
    reply: 'I went round in circles on that one. Ask me again in smaller pieces.',
    toolCalls,
    proposals,
    stoppedEarly,
  }
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}
