'use client'

import { useEffect, useState } from 'react'
import { VetShell } from '@/components/vet/VetShell'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { apiGet, apiPost } from '@/lib/fetch'

interface VetCase {
  id: string
  title: string
  status: string
  description: string | null
  updated_at: string
  animal: { id: string; tag_number: string; name: string | null } | null
}

function statusStyle(status: string) {
  if (status === 'open') return { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', border: 'var(--warning-border)' }
  if (status === 'in_progress') return { bg: 'var(--accent-bg)', fg: 'var(--accent)', border: 'var(--accent)' }
  if (status === 'resolved') return { bg: 'var(--success-bg)', fg: 'var(--success-fg)', border: 'var(--success-border)' }
  return { bg: 'var(--surface-2)', fg: 'var(--text-muted)', border: 'var(--border)' }
}

export default function VetCasesPage() {
  const [cases, setCases]       = useState<VetCase[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    apiGet('/api/vet/cases')
      .then(r => r.json())
      .then(d => { setCases(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const res  = await apiPost('/api/vet/cases', { title, description: desc })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create case'); return }
      setCases(prev => [data.data, ...prev])
      setCreating(false)
      setTitle('')
      setDesc('')
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <VetShell>
      <PageContainer>
        <PageHeader
          title="Cases"
          subtitle="Consultation records"
          actions={<Button intent="primary" size="sm" onClick={() => setCreating(true)}>+ NEW CASE</Button>}
        />

        {creating && (
          <div
            className="mb-5 rounded-[var(--radius-lg)] p-4"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
          >
            <p className="type-panel-title mb-4">New Case</p>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Field label="Title" required>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Respiratory illness #42" autoFocus />
              </Field>
              <Field label="Description">
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Initial observations…" />
              </Field>
              {error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" intent="primary" loading={saving}>CREATE CASE</Button>
                <Button type="button" intent="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
            ))}
          </div>
        )}

        {!loading && cases.length === 0 && (
          <EmptyState variant="action" title="No cases yet" body="Create a case to document a vet consultation."
            action={<Button intent="primary" onClick={() => setCreating(true)}>+ NEW CASE</Button>}
          />
        )}

        {cases.length > 0 && (
          <div className="flex flex-col gap-2">
            {cases.map(c => {
              const style = statusStyle(c.status)
              const animal = c.animal as unknown as { id: string; tag_number: string; name: string | null } | null
              return (
                <Link key={c.id} href={`/vet/cases/${c.id}`}>
                  <div
                    className="rounded-[var(--radius-lg)] p-4 flex items-start justify-between gap-3 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
                  >
                    <div className="min-w-0">
                      <p className="type-data-sm font-semibold truncate">{c.title}</p>
                      {animal && (
                        <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          #{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
                        </p>
                      )}
                    </div>
                    <span
                      className="type-helper px-2 py-0.5 rounded-full capitalize whitespace-nowrap flex-shrink-0"
                      style={{ backgroundColor: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
                    >
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </PageContainer>
    </VetShell>
  )
}
