'use client'

import { useEffect, useState } from 'react'
import { VetShell } from '@/components/vet/VetShell'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'

interface VetMessage {
  id: string
  direction: 'rancher_to_vet' | 'vet_to_rancher'
  body: string
  created_at: string
  read_at: string | null
  animal: { id: string; tag_number: string; name: string | null } | null
}

function fmtTs(ts: string): string {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function VetMessagesPage() {
  const [messages, setMessages] = useState<VetMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState('')

  const loadMessages = async () => {
    try {
      const res  = await fetch('/api/vet/messages')
      const data = await res.json()
      setMessages(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMessages() }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/vet/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_body: body }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      setBody('')
      loadMessages()
    } catch {
      setError('Connection error')
    } finally {
      setSending(false)
    }
  }

  const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <VetShell>
      <PageContainer>
        <PageHeader title="Messages" subtitle="Communication with the ranch" />

        {loading && (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
            ))}
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-3 mb-6">
            {sorted.length === 0 && (
              <p className="type-helper text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No messages yet. Send the first one below.
              </p>
            )}
            {sorted.map(msg => {
              const isVet  = msg.direction === 'vet_to_rancher'
              const animal = msg.animal as unknown as { tag_number: string; name: string | null } | null
              return (
                <div
                  key={msg.id}
                  className={`max-w-[85%] ${isVet ? 'ml-auto' : 'mr-auto'}`}
                >
                  <div
                    className="rounded-[var(--radius-lg)] px-4 py-3"
                    style={{
                      backgroundColor: isVet ? 'var(--accent-bg)' : 'var(--surface-1)',
                      border: `1px solid ${isVet ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <p className="type-body" style={{ color: 'var(--text)' }}>{msg.body}</p>
                    {animal && (
                      <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                        Re: #{animal.tag_number}{animal.name ? ` (${animal.name})` : ''}
                      </p>
                    )}
                  </div>
                  <p className={`type-helper mt-0.5 ${isVet ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>
                    {isVet ? 'You · ' : 'Rancher · '}{fmtTs(msg.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        <div
          className="rounded-[var(--radius-lg)] p-4 sticky bottom-4"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <form onSubmit={handleSend} className="flex flex-col gap-2">
            <Field label="Send message to rancher">
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={2}
                placeholder="Type your message…"
              />
            </Field>
            {error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
            <Button type="submit" intent="primary" size="sm" loading={sending}>SEND</Button>
          </form>
        </div>
      </PageContainer>
    </VetShell>
  )
}
