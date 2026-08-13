'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiGet, apiPost } from '@/lib/fetch'
import { fmtTs } from '@/lib/format'

// ─── Vet types ─────────────────────────────────────────────────────────────

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

// ─── Owner types ────────────────────────────────────────────────────────────

interface OwnerMessage {
  id: string
  owner_id: string
  direction: 'owner_to_rancher' | 'rancher_to_owner'
  body: string
  read_at: string | null
  created_at: string
}

interface OwnerThread {
  owner_id: string
  owner_name: string
  messages: OwnerMessage[]
  unread_count: number
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  // Vet state
  const [threads, setThreads]       = useState<VetThread[]>([])
  const [active, setActive]         = useState<string | null>(null)
  const [vetLoading, setVetLoading] = useState(true)
  const [replyBody, setReplyBody]   = useState('')
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState('')

  // Owner state
  const [ownerThreads, setOwnerThreads]   = useState<OwnerThread[]>([])
  const [activeOwner, setActiveOwner]     = useState<string | null>(null)
  const [ownerLoading, setOwnerLoading]   = useState(true)
  const [ownerReply, setOwnerReply]       = useState('')
  const [ownerSending, setOwnerSending]   = useState(false)
  const [ownerError, setOwnerError]       = useState('')

  // ─── Vet messages ─────────────────────────────────────────────────────

  const loadMessages = async () => {
    try {
      const res  = await apiGet('/api/messages')
      const data = await res.json()
      const msgs: VetMessage[] = data.data ?? []

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
      setVetLoading(false)
    }
  }

  // ─── Owner messages ───────────────────────────────────────────────────

  const loadOwnerMessages = async () => {
    try {
      const res  = await fetch('/api/owner-messages')
      const data = await res.json()
      const ownerData: OwnerThread[] = data.data ?? []
      setOwnerThreads(ownerData)
      if (!activeOwner && ownerData.length > 0) setActiveOwner(ownerData[0].owner_id)
    } finally {
      setOwnerLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
    loadOwnerMessages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Send vet message ────────────────────────────────────────────────

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

  // ─── Send owner message ───────────────────────────────────────────────

  const handleOwnerSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerReply.trim() || !activeOwner) return
    setOwnerSending(true)
    setOwnerError('')
    try {
      const res = await fetch('/api/owner-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: activeOwner, body: ownerReply }),
      })
      if (!res.ok) { const d = await res.json(); setOwnerError(d.error ?? 'Failed'); return }
      setOwnerReply('')
      loadOwnerMessages()
    } catch {
      setOwnerError('Connection error')
    } finally {
      setOwnerSending(false)
    }
  }

  const activeThread = threads.find(t => t.vet_invite_id === active)
  const sortedVetMsgs = activeThread
    ? [...activeThread.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  const activeOwnerThread = ownerThreads.find(t => t.owner_id === activeOwner)
  const sortedOwnerMsgs = activeOwnerThread
    ? [...activeOwnerThread.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  return (
    <PageContainer>
      <PageHeader title="Messages" subtitle="Vet &amp; Owner communications" />

      {/* ── VET MESSAGES ─────────────────────────────────────────── */}
      <div className="mb-2">
        <p className="type-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, fontWeight: 700, marginBottom: 12 }}>VET MESSAGES</p>
      </div>

      {vetLoading && (
        <div className="flex flex-col gap-2 mb-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      )}

      {!vetLoading && threads.length === 0 && (
        <div className="mb-6">
          <EmptyState
            variant="neutral"
            title="No vet messages yet"
            body="Messages from your vet portal will appear here."
          />
        </div>
      )}

      {!vetLoading && threads.length > 0 && (
        <div className="flex gap-5 min-h-[400px] mb-8">
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
                {sortedVetMsgs.map(msg => {
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

      {/* ── OWNER MESSAGES ───────────────────────────────────────── */}
      <div className="mb-2">
        <p className="type-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, fontWeight: 700, marginBottom: 12 }}>OWNER MESSAGES</p>
      </div>

      {ownerLoading && (
        <div className="flex flex-col gap-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      )}

      {!ownerLoading && ownerThreads.length === 0 && (
        <EmptyState
          variant="neutral"
          title="No owner messages yet"
          body="Messages from your owner portal users will appear here."
        />
      )}

      {!ownerLoading && ownerThreads.length > 0 && (
        <div className="flex gap-5 min-h-[400px]">
          {/* Owner thread list */}
          <div className="w-48 flex-shrink-0 flex flex-col gap-1">
            {ownerThreads.map(t => (
              <button
                key={t.owner_id}
                type="button"
                onClick={() => setActiveOwner(t.owner_id)}
                className="text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-colors"
                style={{
                  backgroundColor: activeOwner === t.owner_id ? 'var(--accent-bg)' : 'var(--surface-2)',
                  border: `1px solid ${activeOwner === t.owner_id ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <p className="type-data-sm font-semibold truncate" style={{ color: activeOwner === t.owner_id ? 'var(--accent)' : 'var(--text)' }}>
                  {t.owner_name}
                  {t.unread_count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                      {t.unread_count}
                    </span>
                  )}
                </p>
              </button>
            ))}
          </div>

          {/* Owner messages panel */}
          <div className="flex-1 flex flex-col">
            <Panel title={activeOwnerThread ? activeOwnerThread.owner_name.toUpperCase() : 'OWNER MESSAGES'} className="flex-1 flex flex-col">
              <div className="flex flex-col gap-3 flex-1 mb-4">
                {sortedOwnerMsgs.map(msg => {
                  const isRancher = msg.direction === 'rancher_to_owner'
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
                      </div>
                      <p className={`type-helper mt-0.5 ${isRancher ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>
                        {isRancher ? 'You · ' : `${activeOwnerThread?.owner_name} · `}{fmtTs(msg.created_at)}
                      </p>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleOwnerSend} className="flex flex-col gap-2">
                <Field label="Reply to owner">
                  <Textarea value={ownerReply} onChange={e => setOwnerReply(e.target.value)} rows={2} placeholder="Type a message…" />
                </Field>
                {ownerError && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{ownerError}</p>}
                <Button type="submit" intent="primary" size="sm" loading={ownerSending}>SEND</Button>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
