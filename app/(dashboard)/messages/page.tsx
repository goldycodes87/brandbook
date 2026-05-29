'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiGet, apiPost } from '@/lib/fetch'

interface VetMessage {
  id: string
  direction: 'rancher_to_vet' | 'vet_to_rancher'
  body: string
  created_at: string
  read_at: string | null
  animal: { id: string; tag_number: string; name: string | null } | null
  vet: { name: string | null; practice_name: string | null } | null
}

interface VetThread {
  vet_invite_id: string
  vet_name: string
  practice: string | null
  messages: VetMessage[]
  unread: number
}

function fmtTs(ts: string): string {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MessagesPage() {
  const [threads, setThreads]       = useState<VetThread[]>([])
  const [active, setActive]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [replyBody, setReplyBody]   = useState('')
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState('')

  const loadMessages = async () => {
    try {
      const res  = await apiGet('/api/messages')
      const data = await res.json()
      const msgs: VetMessage[] = data.data ?? []

      // Group by vet_invite_id
      const map = new Map<string, VetThread>()
      for (const m of msgs) {
        const vetId = (m as unknown as { vet_invite_id: string }).vet_invite_id
        if (!map.has(vetId)) {
          map.set(vetId, {
            vet_invite_id: vetId,
            vet_name: m.vet?.name ?? 'Unknown Vet',
            practice: m.vet?.practice_name ?? null,
            messages: [],
            unread: 0,
          })
        }
        const thread = map.get(vetId)!
        thread.messages.push(m)
        if (m.direction === 'vet_to_rancher' && !m.read_at) thread.unread++
      }

      const sorted = Array.from(map.values()).sort((a, b) => {
        const aLast = a.messages[0]?.created_at ?? ''
        const bLast = b.messages[0]?.created_at ?? ''
        return bLast.localeCompare(aLast)
      })

      setThreads(sorted)
      if (!active && sorted.length > 0) setActive(sorted[0].vet_invite_id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMessages() }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim() || !active) return
    setSending(true)
    setError('')
    try {
      const res = await apiPost('/api/messages', { vet_invite_id: active, message_body: replyBody })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      setReplyBody('')
      loadMessages()
    } catch {
      setError('Connection error')
    } finally {
      setSending(false)
    }
  }

  const activeThread = threads.find(t => t.vet_invite_id === active)
  const sorted = activeThread
    ? [...activeThread.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  return (
    <PageContainer>
      <PageHeader title="Messages" subtitle="Vet communications" />

      {loading && (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      )}

      {!loading && threads.length === 0 && (
        <EmptyState
          variant="neutral"
          title="No messages yet"
          body="Messages from your vet portal will appear here."
        />
      )}

      {!loading && threads.length > 0 && (
        <div className="flex gap-5 min-h-[400px]">
          {/* Thread list */}
          <div className="w-48 flex-shrink-0 flex flex-col gap-1">
            {threads.map(t => (
              <button
                key={t.vet_invite_id}
                type="button"
                onClick={() => setActive(t.vet_invite_id)}
                className="text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-colors"
                style={{
                  backgroundColor: active === t.vet_invite_id ? 'var(--accent-bg)' : 'var(--surface-2)',
                  border: `1px solid ${active === t.vet_invite_id ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <p className="type-data-sm font-semibold truncate" style={{ color: active === t.vet_invite_id ? 'var(--accent)' : 'var(--text)' }}>
                  {t.vet_name}
                  {t.unread > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                      {t.unread}
                    </span>
                  )}
                </p>
                {t.practice && <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{t.practice}</p>}
              </button>
            ))}
          </div>

          {/* Messages panel */}
          <div className="flex-1 flex flex-col">
            <Panel title={activeThread ? activeThread.vet_name.toUpperCase() : 'MESSAGES'} className="flex-1 flex flex-col">
              <div className="flex flex-col gap-3 flex-1 mb-4">
                {sorted.map(msg => {
                  const isRancher = msg.direction === 'rancher_to_vet'
                  const animal    = msg.animal as unknown as { tag_number: string; name: string | null } | null
                  return (
                    <div key={msg.id} className={`max-w-[85%] ${isRancher ? 'ml-auto' : 'mr-auto'}`}>
                      <div
                        className="rounded-[var(--radius-lg)] px-4 py-3"
                        style={{
                          backgroundColor: isRancher ? 'var(--accent-bg)' : 'var(--surface-2)',
                          border: `1px solid ${isRancher ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        <p className="type-body">{msg.body}</p>
                        {animal && (
                          <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                            Re: #{animal.tag_number}{animal.name ? ` (${animal.name})` : ''}
                          </p>
                        )}
                      </div>
                      <p className={`type-helper mt-0.5 ${isRancher ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>
                        {isRancher ? 'You · ' : `${activeThread?.vet_name} · `}{fmtTs(msg.created_at)}
                      </p>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleSend} className="flex flex-col gap-2">
                <Field label="Reply">
                  <Textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={2} placeholder="Type a message…" />
                </Field>
                {error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
                <Button type="submit" intent="primary" size="sm" loading={sending}>SEND</Button>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
