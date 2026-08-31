'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, ChevronDown, Mic, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet, apiPost } from '@/lib/fetch'

/**
 * Talking to RancherAI.
 *
 * Built thumb-first: the composer is pinned above the home indicator, the
 * suggestions are tappable, and a proposal is a card with a real button rather
 * than a sentence asking you to type "yes". Somebody using this is standing in
 * a corral holding a phone in one hand.
 */

interface Proposal {
  action: string
  summary: string
  payload: Record<string, unknown>
}

interface Turn {
  role: 'user' | 'assistant'
  content: string
  proposals?: Proposal[]
  used?: Array<{ tool: string; input: unknown }>
  /** Set once a proposal on this turn has been answered, so the card stops asking. */
  settled?: 'done' | 'dropped'
}

const SUGGESTIONS = [
  'Which cows are due in May?',
  "What's Andy's bill for this quarter?",
  'What do I have coming up in the next two weeks?',
  'What did I spend on hay this year?',
]

const TOOL_LABEL: Record<string, string> = {
  find_animals:      'looked through the herd',
  calving_schedule:  'checked the calving book',
  owner_bill:        'added up an owner\'s quarter',
  find_contact:      'looked up a number',
  animal_detail:     'pulled one animal\'s record',
  expense_summary:   'totalled the expenses',
  list_reminders:    'checked what\'s coming up',
  search_sires:      'searched the sire library',
  propose_reminder:  'drafted a reminder',
  propose_expense:   'drafted an expense',
  propose_treatment: 'drafted a treatment',
}

export function RancherChat() {
  const [turns, setTurns]   = useState<Turn[]>([])
  const [draft, setDraft]   = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError]   = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [openTrace, setOpenTrace] = useState<number | null>(null)

  const [callState, setCallState] = useState<'off' | 'connecting' | 'live'>('off')
  const [voiceError, setVoiceError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Typed loosely on purpose: the SDK is imported dynamically so the bundle
  // does not carry it for people who only ever type.
  const vapiRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, sending])

  // A live call outlives a re-render but must not outlive the page.
  useEffect(() => () => { vapiRef.current?.stop(); vapiRef.current = null }, [])

  // Pick the thread back up. A conversation that vanishes when the app closes
  // is a search box, not a conversation — and on a phone the app closes every
  // time somebody takes a call.
  useEffect(() => {
    apiGet('/api/rancher-ai/conversation')
      .then(r => r.json())
      .then(j => {
        if (!j?.conversation) { setLoaded(true); return }
        setConversationId(j.conversation.id)
        setTurns((j.messages ?? []).map((m: { role: string; content: string; used?: Turn['used'] }) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          used: m.used ?? [],
          // A proposal from a previous sitting has been answered or abandoned;
          // either way it must not still be offering a button.
          settled: 'done' as const,
        })))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const send = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || sending) return

    setDraft('')
    setError('')
    setTurns(t => [...t, { role: 'user', content }])
    setSending(true)

    try {
      const res = await apiPost('/api/rancher-ai/message', {
        content,
        conversation_id: conversationId,
        channel: 'text',
      })
      const j = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(j.error ?? 'RancherAI could not answer that.')
        return
      }

      setConversationId(j.conversation_id ?? null)
      setTurns(t => [...t, {
        role: 'assistant',
        content: j.reply ?? '',
        proposals: j.proposals ?? [],
        used: j.used ?? [],
      }])
    } catch {
      setError('No connection. It will work again when you have signal.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [conversationId, sending])

  async function confirm(turnIndex: number, proposal: Proposal) {
    setError('')
    try {
      const res = await apiPost('/api/rancher-ai/confirm', {
        conversation_id: conversationId,
        action: proposal.action,
        payload: proposal.payload,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'That did not save.'); return }

      setTurns(t => t.map((turn, i) => (i === turnIndex ? { ...turn, settled: 'done' } : turn)))
      setTurns(t => [...t, { role: 'assistant', content: j.confirmation ?? 'Saved.' }])
    } catch {
      setError('No connection — nothing was saved.')
    }
  }

  function drop(turnIndex: number) {
    setTurns(t => t.map((turn, i) => (i === turnIndex ? { ...turn, settled: 'dropped' } : turn)))
  }

  async function startCall() {
    setVoiceError('')
    const publicKey = process.env.NEXT_PUBLIC_VAPI_KEY
    if (!publicKey) {
      setVoiceError('Voice is not switched on yet — NEXT_PUBLIC_VAPI_KEY has not been set.')
      return
    }

    setCallState('connecting')
    try {
      const res = await apiGet('/api/rancher-ai/voice-config')
      const config = await res.json()
      if (!res.ok) { setVoiceError(config.error ?? 'Could not start voice.'); setCallState('off'); return }

      const { default: Vapi } = await import('@vapi-ai/web')
      const vapi = new Vapi(publicKey)
      vapiRef.current = vapi

      vapi.on('call-start', () => setCallState('live'))
      vapi.on('call-end', () => { setCallState('off'); vapiRef.current = null })
      vapi.on('error', () => {
        setVoiceError('The call dropped.')
        setCallState('off')
        vapiRef.current = null
      })

      // Spoken turns land in the same thread as typed ones, so a question
      // asked at the chute can be followed up on at the desk.
      vapi.on('message', (m: { type?: string; role?: string; transcriptType?: string; transcript?: string }) => {
        if (m?.type === 'transcript' && m.transcriptType === 'final' && m.transcript) {
          setTurns(t => [...t, {
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.transcript!,
          }])
        }
      })

      // A call needs a thread to write into before it starts talking — the
      // webhook has no way to create one mid-sentence, and a proposal with
      // nowhere to park is a proposal that can never be confirmed.
      let threadId = conversationId
      if (!threadId) {
        const opened = await apiPost('/api/rancher-ai/conversation', { title: 'Voice call' })
        const oj = await opened.json().catch(() => ({}))
        threadId = oj.conversation_id ?? null
        if (threadId) setConversationId(threadId)
      }

      vapi.start({
        transcriber: config.transcriber,
        model: {
          provider: 'anthropic',
          model: 'claude-opus-5',
          messages: [{ role: 'system', content: config.systemPrompt }],
          tools: config.tools,
        },
        voice: config.voice,
        firstMessage: config.firstMessage,
        // Read back by the webhook. Without these a call cannot save a record
        // or attribute one to anybody.
        metadata: {
          conversation_id: threadId,
          auth_user_id: config.authUserId,
          speaking: config.speaking,
        },
      } as unknown as Parameters<typeof vapi.start>[0])
    } catch {
      setVoiceError('Could not start voice. Check the microphone permission.')
      setCallState('off')
      vapiRef.current = null
    }
  }

  function endCall() {
    vapiRef.current?.stop()
    vapiRef.current = null
    setCallState('off')
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 120px)' }}>
      <div className="flex-1 flex flex-col gap-4 pb-4">
        {/* Held back until the thread has loaded, so reopening the app does not
            flash the empty state at somebody who has a conversation waiting. */}
        {loaded && turns.length === 0 && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
              Ask about the herd, the money or what&apos;s coming up. It reads the real records —
              it will not guess a number at you.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-[var(--radius-lg)] text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={turn.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2'}>
            {turn.role === 'user' ? (
              <div
                className="px-4 py-2.5 rounded-[var(--radius-lg)] text-sm max-w-[85%]"
                style={{ background: 'var(--accent-soft)', color: 'var(--text)', border: '1px solid var(--accent-border)' }}
              >
                {turn.content}
              </div>
            ) : (
              <>
                <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                  {turn.content}
                </div>

                {/* A write is a card with a button, never a sentence asking you
                    to type yes. On a phone, in the wind, that difference is the
                    difference between a record and a mistake. */}
                {turn.proposals?.map((p, pi) => (
                  <div
                    key={pi}
                    className="rounded-[var(--radius-lg)] px-4 py-3 flex flex-col gap-3"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
                  >
                    <div>
                      <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>
                        {turn.settled === 'done' ? 'SAVED' : turn.settled === 'dropped' ? 'DISCARDED' : 'CONFIRM'}
                      </p>
                      <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{p.summary}</p>
                    </div>
                    {!turn.settled && (
                      <div className="flex gap-2">
                        <Button intent="primary" size="sm" onClick={() => confirm(i, p)}>YES, SAVE IT</Button>
                        <Button intent="ghost" size="sm" onClick={() => drop(i)}>NO</Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* What it looked at. Folded away, but there — an answer about
                    money should be checkable without opening the database. */}
                {(turn.used?.length ?? 0) > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenTrace(openTrace === i ? null : i)}
                      className="type-helper flex items-center gap-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <ChevronDown
                        size={12}
                        style={{ transform: openTrace === i ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}
                      />
                      {turn.used!.length === 1 ? 'What it checked' : `What it checked (${turn.used!.length})`}
                    </button>
                    {openTrace === i && (
                      <ul className="mt-1.5 flex flex-col gap-1 pl-4">
                        {turn.used!.map((u, ui) => (
                          <li key={ui} className="type-helper" style={{ color: 'var(--text-muted)', listStyle: 'disc' }}>
                            {TOOL_LABEL[u.tool] ?? u.tool}
                            <span className="opacity-60"> — {JSON.stringify(u.input)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {sending && (
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Checking the records…</p>
        )}

        {error && <ContextBanner tone="danger">{error}</ContextBanner>}

        <div ref={endRef} />
      </div>

      {/* Pinned above the home indicator, not under it. */}
      <div
        className="sticky bottom-0 pt-2"
        style={{
          background: 'var(--surface-0, var(--surface-1))',
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        }}
      >
        {voiceError && (
          <div className="pb-2">
            <ContextBanner tone="warning">{voiceError}</ContextBanner>
          </div>
        )}

        {callState === 'live' && (
          <div className="pb-2">
            <ContextBanner tone="accent">Listening. Speak normally — you can cut it off mid-sentence.</ContextBanner>
          </div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); send(draft) }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              // Enter sends on a keyboard; on a phone the send button is the way,
              // so a newline stays possible with shift.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) }
            }}
            rows={1}
            placeholder="Ask about the herd…"
            className="flex-1 px-4 py-3 rounded-[var(--radius-lg)] text-base resize-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              maxHeight: 120,
            }}
          />
          {/* Talk when your hands are dirty, type when they are not. */}
          {callState === 'off' ? (
            <Button type="button" intent="secondary" onClick={startCall} aria-label="Talk to it">
              <Mic size={16} />
            </Button>
          ) : (
            <Button type="button" intent="ghost" onClick={endCall}
                    loading={callState === 'connecting'} aria-label="End the call">
              <PhoneOff size={16} />
            </Button>
          )}
          <Button type="submit" intent="primary" disabled={!draft.trim()} loading={sending}
                  aria-label="Send">
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  )
}
