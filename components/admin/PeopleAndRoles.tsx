'use client'

import { useState, useEffect, useCallback } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import Badge from '@/components/ui/Badge'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

interface Person {
  id: string
  role: string
  roleLabel: string
  status: string
  name: string
  email: string | null
  practice: string | null
  hasPassword: boolean
  herd: string | null
  accepted: boolean
  onboarded: boolean
  inviteToken: string | null
}

interface RoleOption { value: string; label: string }

export function PeopleAndRoles() {
  const [people, setPeople]   = useState<Person[]>([])
  const [roles, setRoles]     = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState<string | null>(null)

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', practice_name: '', role: 'co_admin' })
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  // The revealed portal link, for one person at a time.
  const [link, setLink]     = useState<{ id: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [sent, setSent]     = useState<string | null>(null)

  // The first read is written out in the effect rather than routed through
  // `load` below: a setState the linter can trace back into an effect body is
  // the cascading-render pattern it exists to catch, even behind a promise.
  useEffect(() => {
    apiGet('/api/admin/people')
      .then(r => r.json())
      .then(j => { setPeople(j.data ?? []); setRoles(j.roles ?? []); setLoading(false) })
      .catch(() => { setError('Could not load people'); setLoading(false) })
  }, [])

  // Every read after the first — a role change or a fresh invite.
  const load = useCallback(async () => {
    const res = await apiGet('/api/admin/people')
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Could not load people'); return }
    setPeople(j.data ?? [])
    setRoles(j.roles ?? [])
  }, [])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setBusy('invite'); setError(''); setInviteUrl(null)
    try {
      const res = await apiPost('/api/admin/people', form)
      const j = await res.json()
      if (!res.ok) { setError(j.error ?? 'Could not send that invite'); return }
      setInviteUrl(j.inviteUrl)
      setForm({ first_name: '', last_name: '', email: '', practice_name: '', role: 'co_admin' })
      await load()
    } finally { setBusy(null) }
  }

  async function change(id: string, patch: Record<string, unknown>) {
    setBusy(id); setError('')
    try {
      const res = await apiPatch(`/api/admin/people/${id}`, patch)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not change that'); return }
      await load()
    } finally { setBusy(null) }
  }

  async function showLink(id: string) {
    if (link?.id === id) { setLink(null); return }
    setBusy(`link-${id}`); setError(''); setSent(null); setCopied(false)
    try {
      const res = await apiGet(`/api/admin/people/${id}/portal-link`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not get that link'); return }
      setLink({ id, url: j.url })
    } finally { setBusy(null) }
  }

  async function emailLink(id: string) {
    setBusy(`send-${id}`); setError('')
    try {
      const res = await apiPost(`/api/admin/people/${id}/portal-link`, {})
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'That did not send'); return }
      setSent(id)
    } finally { setBusy(null) }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers.
      // The link is on screen either way, which is the fallback.
      setError('Could not copy — select the link above instead.')
    }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6 pb-8">
      {error && <ContextBanner tone="danger">{error}</ContextBanner>}

      <Panel title="WHO HAS ACCESS" subtitle={`${people.length} ${people.length === 1 ? 'person' : 'people'}`}>
        {people.map(p => (
          <PanelSection key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</p>
                <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  {[p.email, p.practice, p.herd].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="neutral">{p.roleLabel}</Badge>
                  {p.hasPassword
                    ? <Badge variant="info">Password</Badge>
                    : <Badge variant="neutral">Magic link</Badge>}
                  {!p.accepted     && <Badge variant="warning">Not accepted</Badge>}
                  {p.accepted && !p.onboarded && <Badge variant="warning">Setup unfinished</Badge>}
                  {p.onboarded     && <Badge variant="success">Set up</Badge>}
                </div>
                {/* Revealed on demand rather than printed beside every name:
                    the link IS the credential, and a screen full of them is a
                    screen you would not want anyone reading over your
                    shoulder. */}
                {link?.id === p.id && (
                  <div className="mt-2 flex flex-col gap-2">
                    <code className="type-helper break-all px-2 py-1.5 rounded"
                          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {link.url}
                    </code>
                    <div className="flex flex-wrap gap-2">
                      <Button intent="ghost" size="sm" onClick={() => copy(link.url)}>
                        {copied ? 'COPIED' : 'COPY'}
                      </Button>
                      {p.email && (
                        <Button intent="ghost" size="sm" loading={busy === `send-${p.id}`}
                                onClick={() => emailLink(p.id)}>
                          EMAIL IT TO THEM
                        </Button>
                      )}
                      <Button intent="ghost" size="sm" onClick={() => setLink(null)}>HIDE</Button>
                    </div>
                    {sent === p.id && (
                      <p className="type-helper" style={{ color: 'var(--success-fg)' }}>
                        Sent to {p.email}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Owner access is attached to a herd, so it is changed where
                    herds are. Offering it here would only produce an error. */}
                {p.role !== 'owner' && (
                  <Select
                    value={p.role}
                    onChange={e => change(p.id, { role: e.target.value })}
                    disabled={busy === p.id}
                    style={{ minWidth: 150 }}
                  >
                    {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                )}
                <Button intent="ghost" size="sm" loading={busy === `link-${p.id}`}
                        onClick={() => showLink(p.id)}>
                  PORTAL LINK
                </Button>
                <Button intent="ghost" size="sm" loading={busy === p.id}
                        onClick={() => change(p.id, { status: 'revoked' })}>
                  REVOKE
                </Button>
              </div>
            </div>
          </PanelSection>
        ))}
      </Panel>

      <Panel title="INVITE SOMEBODY" subtitle="They get a link — no password to set up">
        <PanelSection>
          <form onSubmit={invite} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name">
                <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
              </Field>
              <Field label="Last name">
                <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
              </Field>
            </div>
            <Field label="Email" helper="Where the invite goes">
              <Input type="email" required value={form.email}
                     onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
            {form.role === 'vet' && (
              <Field label="Practice">
                <Input value={form.practice_name}
                       onChange={e => setForm(f => ({ ...f, practice_name: e.target.value }))}
                       placeholder="Platte Valley Large Animal" />
              </Field>
            )}
            <div>
              <Button type="submit" intent="primary" loading={busy === 'invite'}>SEND INVITE</Button>
            </div>
          </form>

          {inviteUrl && (
            <div className="mt-4">
              <ContextBanner tone="success">
                Invite ready. Send them this link:
                <br />
                <code className="break-all">{inviteUrl}</code>
              </ContextBanner>
            </div>
          )}
        </PanelSection>
      </Panel>

      <Panel title="WHAT EACH ROLE REACHES">
        <PanelSection>
          <div className="flex flex-col gap-2 text-sm">
            <p><strong>Admin</strong> — everything, including Data. The only role that can import or run cleanup.</p>
            <p><strong>Ranch Manager</strong> — everything except Data. Runs the operation day to day.</p>
            <p><strong>CPA</strong> — Billing and the tax reports, read only. No animal records.</p>
            <p><strong>Veterinarian</strong> — health and breeding for every animal. Never sees money.</p>
            <p><strong>Owner</strong> — only their own cattle, invoices and expense shares.</p>
          </div>
        </PanelSection>
      </Panel>
    </div>
  )
}
