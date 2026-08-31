'use client'

import { useState, useEffect, useCallback } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import Badge from '@/components/ui/Badge'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

interface Contact {
  id: string
  name: string
  role: string | null
  company: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

const ROLE_LABEL: Record<string, string> = {
  ai_tech:         'AI technician',
  vet:             'Veterinarian',
  hauler:          'Hauler',
  nutritionist:    'Nutritionist',
  brand_inspector: 'Brand inspector',
  auction:         'Auction barn',
  other:           'Other',
}

const EMPTY = { name: '', role: 'ai_tech', company: '', phone: '', email: '', notes: '' }

/**
 * The numbers you call, in the app instead of in your head.
 *
 * This is also what RancherAI reads when somebody asks for the AI tech's phone
 * number. Before this existed the question had no answer anywhere in the
 * schema — a technician's name could be a default on the breeding form, but a
 * name is not a phone number.
 */
export function RanchContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState<string | null>(null)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState(EMPTY)

  const load = useCallback(async () => {
    const res = await apiGet('/api/admin/contacts')
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Could not load contacts'); return }
    setContacts(j.data ?? [])
  }, [])

  // Written out rather than routed through `load` — see PeopleAndRoles.
  useEffect(() => {
    apiGet('/api/admin/contacts')
      .then(r => r.json())
      .then(j => { setContacts(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy('add'); setError('')
    try {
      const res = await apiPost('/api/admin/contacts', form)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not save that contact'); return }
      setForm(EMPTY)
      setAdding(false)
      await load()
    } finally { setBusy(null) }
  }

  async function remove(id: string) {
    setBusy(id); setError('')
    try {
      const res = await apiPatch(`/api/admin/contacts/${id}`, { is_active: false })
      if (!res.ok) { setError('Could not remove that contact'); return }
      await load()
    } finally { setBusy(null) }
  }

  if (loading) return null

  return (
    <Panel title="WHO YOU CALL" subtitle="Phone numbers, not logins — nobody here can sign in">
      <PanelSection>
        {error && <ContextBanner tone="danger">{error}</ContextBanner>}

        {contacts.length === 0 && !adding && (
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Nobody saved yet. Add the AI tech, the hauler, the brand inspector — anyone you
            look up on your phone at the chute.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {contacts.map(c => (
            <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-2"
                 style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.name}</p>
                <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  {[c.company, c.phone, c.email].filter(Boolean).join(' · ') || 'No number saved'}
                </p>
                <div className="mt-1">
                  <Badge variant="neutral">{ROLE_LABEL[c.role ?? 'other'] ?? c.role}</Badge>
                </div>
              </div>
              <Button intent="ghost" size="sm" loading={busy === c.id} onClick={() => remove(c.id)}>
                REMOVE
              </Button>
            </div>
          ))}
        </div>

        {adding ? (
          <form onSubmit={add} className="flex flex-col gap-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name">
                <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                       placeholder="Spencer" />
              </Field>
              <Field label="What they do">
                <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Phone">
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                       placeholder="(555) 000-0000" />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" intent="primary" size="sm" loading={busy === 'add'}>SAVE</Button>
              <Button type="button" intent="ghost" size="sm" onClick={() => { setAdding(false); setForm(EMPTY) }}>
                CANCEL
              </Button>
            </div>
          </form>
        ) : (
          <Button intent="ghost" size="sm" className="mt-3" onClick={() => setAdding(true)}>
            + ADD SOMEBODY
          </Button>
        )}
      </PanelSection>
    </Panel>
  )
}
