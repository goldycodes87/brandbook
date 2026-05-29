'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { VetShell } from '@/components/vet/VetShell'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Field, Textarea, Select } from '@/components/ui/Field'
import Link from 'next/link'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

interface CaseNote {
  id: string
  author_role: string
  body: string
  created_at: string
}

interface VetCaseDetail {
  id: string
  title: string
  status: string
  description: string | null
  created_at: string
  updated_at: string
  animal: { id: string; tag_number: string; name: string | null; breed: string | null; sex: string | null } | null
  notes: CaseNote[]
}

function fmtTs(ts: string): string {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function VetCaseDetailPage() {
  const { id }              = useParams<{ id: string }>()
  const [data, setData]     = useState<VetCaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteBody, setNoteBody] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError]   = useState('')

  const loadCase = async () => {
    try {
      const res = await apiGet(`/api/vet/cases/${id}`)
      const json = await res.json()
      if (res.ok) setData(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCase() }, [id])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    setAddingNote(true)
    setError('')
    try {
      const res = await apiPost(`/api/vet/cases/${id}/notes`, { body: noteBody })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      setNoteBody('')
      loadCase()
    } catch {
      setError('Connection error')
    } finally {
      setAddingNote(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      await apiPatch(`/api/vet/cases/${id}`, { status: newStatus })
      loadCase()
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <VetShell>
        <PageContainer>
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
            ))}
          </div>
        </PageContainer>
      </VetShell>
    )
  }

  if (!data) {
    return (
      <VetShell>
        <PageContainer>
          <p style={{ color: 'var(--danger-fg)' }}>Case not found.</p>
        </PageContainer>
      </VetShell>
    )
  }

  const animal = data.animal as unknown as { id: string; tag_number: string; name: string | null } | null

  return (
    <VetShell>
      <PageContainer>
        <PageHeader
          title={data.title}
          subtitle={<><a href="/vet/cases" style={{ color: 'var(--accent)' }}>← Cases</a></>}
          actions={
            <Select value={data.status} onChange={e => handleStatusChange(e.target.value)} disabled={updatingStatus}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          }
        />

        {animal && (
          <div className="mb-4 type-helper" style={{ color: 'var(--text-muted)' }}>
            Animal:{' '}
            <Link href={`/vet/animals/${animal.id}`} className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
              #{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
            </Link>
          </div>
        )}

        {data.description && (
          <Panel title="DESCRIPTION" className="mb-4">
            <p className="type-body" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>
          </Panel>
        )}

        <Panel title="NOTES & DISCUSSION">
          <div className="flex flex-col gap-3 mb-4">
            {data.notes.length === 0 && (
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>No notes yet — add the first one below.</p>
            )}
            {data.notes.map(note => (
              <div key={note.id} className={`rounded-[var(--radius-md)] p-3 ${note.author_role === 'vet' ? 'ml-4' : 'mr-4'}`}
                style={{
                  backgroundColor: note.author_role === 'vet' ? 'var(--accent-bg)' : 'var(--surface-2)',
                  border: `1px solid ${note.author_role === 'vet' ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="type-field-label capitalize" style={{ color: note.author_role === 'vet' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {note.author_role === 'vet' ? 'You (vet)' : 'Rancher'}
                  </span>
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtTs(note.created_at)}</span>
                </div>
                <p className="type-body" style={{ color: 'var(--text)' }}>{note.body}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddNote} className="flex flex-col gap-2">
            <Field label="Add note">
              <Textarea
                value={noteBody}
                onChange={e => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Add clinical notes, instructions, or follow-up…"
              />
            </Field>
            {error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
            <Button type="submit" intent="primary" size="sm" loading={addingNote}>ADD NOTE</Button>
          </form>
        </Panel>
      </PageContainer>
    </VetShell>
  )
}
