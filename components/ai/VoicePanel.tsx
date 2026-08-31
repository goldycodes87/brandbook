'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet, apiPost } from '@/lib/fetch'

/**
 * The voice half, built the way the Clozr coaches were: a screen of its own
 * rather than a mic button tucked into the composer.
 *
 * The state machine is the point. On a call you cannot see a cursor blink, so
 * the button itself has to say whether it is connecting, listening, or talking
 * back — otherwise the only feedback is silence, and silence is exactly what a
 * broken call looks like too.
 */

export type CallStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ending'

interface Turn { role: 'user' | 'assistant'; text: string }

const STATUS_TEXT: Record<CallStatus, string> = {
  idle:       'Tap to talk',
  connecting: 'Getting ready…',
  listening:  'Listening',
  speaking:   'Talking',
  ending:     'Hanging up…',
}

function Waveform({ fast }: { fast?: boolean }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="animate-ai-bar"
          style={{
            width: 5,
            height: 34,
            borderRadius: 3,
            background: 'var(--accent)',
            animationDelay: `${i * 0.11}s`,
            animationDuration: fast ? '0.6s' : '1.1s',
          }}
        />
      ))}
    </div>
  )
}

export function VoicePanel({
  conversationId,
  onConversationId,
  onFinished,
}: {
  conversationId: string | null
  onConversationId: (id: string) => void
  /** Called once a call ends with something worth reading in the chat. */
  onFinished: () => void
}) {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [error, setError]   = useState('')
  const [transcript, setTranscript] = useState<Turn[]>([])
  const [justEnded, setJustEnded]   = useState(false)

  const vapiRef = useRef<{ stop: () => void } | null>(null)
  // Kept in a ref as well as state: the call-end handler is a closure created
  // when the call started, and it needs the whole transcript, not the empty
  // array it captured.
  const transcriptRef = useRef<Turn[]>([])
  const threadRef     = useRef<string | null>(conversationId)

  useEffect(() => { threadRef.current = conversationId }, [conversationId])

  // A live call outlives a re-render but must not outlive the page.
  useEffect(() => () => { vapiRef.current?.stop(); vapiRef.current = null }, [])

  // A plain function rather than a memoized one: it is only ever an onClick,
  // and the compiler cannot preserve memoization across the ref writes and the
  // dynamic import inside it.
  async function start() {
    if (status !== 'idle') return
    setError('')
    setJustEnded(false)
    setTranscript([])
    transcriptRef.current = []

    const publicKey = process.env.NEXT_PUBLIC_VAPI_KEY
    if (!publicKey) {
      setError('Voice is not switched on yet — NEXT_PUBLIC_VAPI_KEY has not been set.')
      return
    }

    setStatus('connecting')
    try {
      const res = await apiGet('/api/rancher-ai/voice-config')
      const config = await res.json()
      if (!res.ok) { setError(config.error ?? 'Could not start voice.'); setStatus('idle'); return }

      // A call needs a thread before it starts talking: the webhook cannot make
      // one mid-sentence, and a proposal with nowhere to park can never be
      // confirmed.
      let threadId = threadRef.current
      if (!threadId) {
        const opened = await apiPost('/api/rancher-ai/conversation', { title: 'Voice call' })
        const oj = await opened.json().catch(() => ({}))
        threadId = oj.conversation_id ?? null
        if (threadId) { threadRef.current = threadId; onConversationId(threadId) }
      }

      const { default: Vapi } = await import('@vapi-ai/web')
      const vapi = new Vapi(publicKey)
      vapiRef.current = vapi

      vapi.on('call-start', () => setStatus('listening'))
      // Which way the conversation is flowing. Without these the button sits
      // there looking identical whether it is thinking or dead.
      vapi.on('speech-start', () => setStatus('speaking'))
      vapi.on('speech-end',   () => setStatus('listening'))

      vapi.on('message', (m: { type?: string; role?: string; transcriptType?: string; transcript?: string }) => {
        if (m?.type === 'transcript' && m.transcriptType === 'final' && m.transcript) {
          const turn: Turn = { role: m.role === 'assistant' ? 'assistant' : 'user', text: m.transcript }
          transcriptRef.current = [...transcriptRef.current, turn]
          setTranscript(t => [...t, turn])
        }
      })

      vapi.on('call-end', () => {
        setStatus('ending')
        const turns = transcriptRef.current

        // Saved from here as well as by the end-of-call webhook. Belt and
        // braces on purpose: the webhook is the piece whose envelope shape
        // varies between Vapi versions, and a lost transcript is a lost record
        // of what somebody was told.
        if (turns.length > 0 && threadRef.current) {
          void apiPost('/api/rancher-ai/voice-transcript', {
            conversation_id: threadRef.current,
            turns,
          }).catch(() => {})
        }

        vapiRef.current = null
        transcriptRef.current = []
        setStatus('idle')
        setJustEnded(turns.length > 0)
        if (turns.length > 0) onFinished()
      })

      vapi.on('error', () => {
        vapiRef.current = null
        setStatus('idle')
        setError('The call dropped.')
      })

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
        metadata: {
          conversation_id: threadId,
          auth_user_id: config.authUserId,
          speaking: config.speaking,
        },
      } as unknown as Parameters<typeof vapi.start>[0])
    } catch {
      setError('Could not start voice. Check that the browser has the microphone.')
      setStatus('idle')
      vapiRef.current = null
    }
  }

  function end() {
    setStatus('ending')
    vapiRef.current?.stop()
  }

  const live = status === 'listening' || status === 'speaking'

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-10 gap-6">
      {error && <ContextBanner tone="danger">{error}</ContextBanner>}

      {justEnded ? (
        <div className="flex flex-col items-center gap-4 text-center animate-ai-rise">
          <p className="type-body" style={{ color: 'var(--text)' }}>
            Saved to the conversation.
          </p>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Anything you asked it to record is in the chat, waiting on your yes.
          </p>
          <Button intent="secondary" onClick={() => setJustEnded(false)}>TALK AGAIN</Button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={status === 'idle' ? start : undefined}
            disabled={status !== 'idle'}
            aria-label={STATUS_TEXT[status]}
            className={
              status === 'idle' ? 'animate-ai-breathe'
              : status === 'speaking' ? 'animate-ai-pulse'
              : undefined
            }
            style={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: status === 'idle' ? 'pointer' : 'default',
              background: live ? 'var(--accent-soft)' : 'var(--surface-2)',
              border: `2px solid ${live ? 'var(--accent)' : 'var(--border-strong)'}`,
              boxShadow: live ? '0 0 40px var(--accent-soft)' : 'none',
              transition: 'background .3s, border-color .3s, box-shadow .3s',
            }}
          >
            {status === 'idle' && (
              <span style={{ fontSize: 52, lineHeight: 1 }} aria-hidden>🎙️</span>
            )}
            {(status === 'connecting' || status === 'ending') && (
              <span
                className="animate-spin"
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                }}
                aria-hidden
              />
            )}
            {status === 'listening' && <Waveform />}
            {status === 'speaking'  && <Waveform fast />}
          </button>

          <p className="type-section-label" style={{ color: live ? 'var(--accent)' : 'var(--text-muted)' }}>
            {STATUS_TEXT[status]}
          </p>

          {status === 'idle' && (
            <p className="type-helper text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Ask it anything you would type. To record something, it reads the whole
              thing back and waits for a yes before it saves.
            </p>
          )}

          {live && (
            <Button intent="ghost" onClick={end}>END THE CALL</Button>
          )}

          {transcript.length > 0 && (
            <div className="w-full max-w-md flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 260 }}>
              {transcript.map((t, i) => (
                <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className="px-3 py-2 text-sm animate-ai-rise"
                    style={{
                      maxWidth: '85%',
                      background: t.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)',
                      border: `1px solid ${t.role === 'user' ? 'var(--accent-border)' : 'var(--border)'}`,
                      color: 'var(--text)',
                      borderRadius: t.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    }}
                  >
                    {t.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
