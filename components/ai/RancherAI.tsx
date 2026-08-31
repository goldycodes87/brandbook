'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, Mic, Clock } from 'lucide-react'
import { RancherChat } from './RancherChat'
import { VoicePanel } from './VoicePanel'
import { AiHistory } from './AiHistory'

/**
 * One assistant, two ways in — the shape the Clozr coaches use.
 *
 * Chat and Voice are tabs rather than a mic button in the composer, because
 * they want opposite things from a screen. Typing wants the keyboard and a
 * scrollback; talking wants one large target you can hit without looking, and
 * nothing else competing for the thumb.
 *
 * The conversation lives up here so both halves write into the same thread. A
 * question asked out loud at the chute and followed up on by typing at the
 * desk is one conversation, not two.
 */
export function RancherAI() {
  const [tab, setTab] = useState<'chat' | 'voice'>('chat')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  // Bumped when a call ends, so the chat pulls in what was said out loud.
  const [reloadKey, setReloadKey] = useState(0)

  const adoptConversation = useCallback((id: string) => setConversationId(id), [])
  const afterCall = useCallback(() => {
    setReloadKey(k => k + 1)
    // Straight back to the transcript, where a proposal waiting on a yes will
    // be — a call that ended with something unconfirmed must not look finished.
    setTab('chat')
  }, [])

  const TABS = [
    { id: 'chat'  as const, label: 'Chat',  Icon: MessageSquare },
    { id: 'voice' as const, label: 'Talk',  Icon: Mic },
  ]

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 pb-3">
        <div
          className="flex-1 flex gap-1 p-1 rounded-[var(--radius-lg)]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          role="tablist"
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] type-field-label"
                style={{
                  // 44px so it is hittable with a glove on.
                  minHeight: 44,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'transparent'}`,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'background .15s, color .15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowHistory(true)}
          aria-label="Earlier conversations"
          className="flex items-center justify-center rounded-[var(--radius-lg)]"
          style={{
            width: 44, height: 44,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <Clock size={16} />
        </button>
      </div>

      {/* Both stay mounted. Unmounting the voice panel mid-call would drop the
          call, and unmounting the chat would throw away the scrollback every
          time somebody glanced at the other tab. */}
      <div hidden={tab !== 'chat'}>
        <RancherChat
          conversationId={conversationId}
          onConversationId={adoptConversation}
          reloadKey={reloadKey}
        />
      </div>
      <div hidden={tab !== 'voice'}>
        <VoicePanel
          conversationId={conversationId}
          onConversationId={adoptConversation}
          onFinished={afterCall}
        />
      </div>

      {showHistory && (
        <AiHistory
          onClose={() => setShowHistory(false)}
          onPick={id => {
            setConversationId(id)
            setReloadKey(k => k + 1)
            setShowHistory(false)
            setTab('chat')
          }}
        />
      )}
    </div>
  )
}
