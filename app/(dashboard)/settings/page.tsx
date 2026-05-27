'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import type { TabItem } from '@/components/ui/Tabs'
import { BrandDrawingPad } from '@/components/settings/BrandDrawingPad'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RanchSettings {
  ranch_name: string
  owner_name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  timezone: string
  logo_url: string
  brand_photo_url: string
}

interface Profile {
  id: string
  name: string
  phone: string
  avatar_url: string
  email: string
  role: string
}

interface NotifPrefs {
  withdrawal_alerts: boolean
  lease_renewal_alerts: boolean
  calving_reminders: boolean
  weight_reminders: boolean
  email_notifications: boolean
  alert_lead_days: number
}

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  invite_accepted_at: string | null
  created_at: string
}

// ─── Ranch Tab ───────────────────────────────────────────────────────────────

function RanchTab() {
  const [form, setForm] = useState<RanchSettings>({
    ranch_name: '', owner_name: '', address: '', city: '', state: '', zip: '',
    phone: '', email: '', timezone: 'America/Denver', logo_url: '', brand_photo_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/ranch')
      .then(r => r.json())
      .then(d => {
        const s = d.data ?? d
        setForm(f => ({
          ...f,
          ...Object.fromEntries(Object.entries(s as Record<string, unknown>).map(([k, v]) => [k, v ?? ''])),
        }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const set = (k: keyof RanchSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleBrandSave = async (url: string) => {
    setForm(f => ({ ...f, brand_photo_url: url }))
    await fetch('/api/settings/ranch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_photo_url: url }),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/settings/ranch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Panel title="RANCH PROFILE">
        <PanelSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ranch name">
              <Input value={form.ranch_name} onChange={set('ranch_name')} placeholder="Circle K Ranch" />
            </Field>
            <Field label="Owner name">
              <Input value={form.owner_name} onChange={set('owner_name')} placeholder="John Smith" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" type="tel" />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={set('email')} placeholder="ranch@example.com" type="email" />
            </Field>
          </div>
        </PanelSection>
        <PanelSection>
          <Field label="Address">
            <Input value={form.address} onChange={set('address')} placeholder="123 Ranch Road" />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div className="col-span-2">
              <Field label="City">
                <Input value={form.city} onChange={set('city')} placeholder="Laramie" />
              </Field>
            </div>
            <Field label="State">
              <Input value={form.state} onChange={set('state')} placeholder="WY" maxLength={2} />
            </Field>
            <Field label="ZIP">
              <Input value={form.zip} onChange={set('zip')} placeholder="82070" />
            </Field>
          </div>
        </PanelSection>
        <PanelSection>
          <Field label="Timezone">
            <Select value={form.timezone} onChange={set('timezone')}>
              <option value="America/New_York">Eastern</option>
              <option value="America/Chicago">Central</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Phoenix">Mountain (no DST)</option>
              <option value="America/Los_Angeles">Pacific</option>
              <option value="America/Anchorage">Alaska</option>
              <option value="Pacific/Honolulu">Hawaii</option>
            </Select>
          </Field>
        </PanelSection>
      </Panel>

      <Panel title="BRANDING">
        <PanelSection>
          <Field label="Logo URL" helper="Direct link to your logo image">
            <Input value={form.logo_url} onChange={set('logo_url')} placeholder="https://…" />
          </Field>
        </PanelSection>
        <PanelSection>
          <p className="type-field-label mb-3" style={{ color: 'var(--text)' }}>Brand image</p>
          <BrandDrawingPad
            existingUrl={form.brand_photo_url || undefined}
            onSave={handleBrandSave}
          />
        </PanelSection>
      </Panel>

      {error && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--success-fg)', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
          Saved successfully
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" intent="primary" loading={saving}>SAVE CHANGES</Button>
      </div>
    </form>
  )
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.json())
      .then(d => {
        const p = d.profile ?? {}
        setProfile({ ...p, email: d.user?.email ?? '' })
        setName(p.name ?? '')
        setPhone(p.phone ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Panel title="MY ACCOUNT">
        <PanelSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Rancher" />
            </Field>
            <Field label="Email" helper="Cannot be changed">
              <Input value={profile?.email ?? ''} disabled />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" type="tel" />
            </Field>
            <Field label="Role">
              <Input value={profile?.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? ''} disabled />
            </Field>
          </div>
        </PanelSection>
      </Panel>

      {error && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--success-fg)', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
          Saved successfully
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" intent="primary" loading={saving}>SAVE CHANGES</Button>
      </div>
    </form>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

const LEAD_DAY_SEGMENTS = [
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
]

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>({
    withdrawal_alerts: true, lease_renewal_alerts: true, calving_reminders: true,
    weight_reminders: false, email_notifications: true, alert_lead_days: 7,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.json())
      .then(d => { setPrefs(p => ({ ...p, ...(d.data ?? d) })); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (k: keyof NotifPrefs) => (val: boolean) => setPrefs(p => ({ ...p, [k]: val }))

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <Panel title="ALERTS">
        <PanelSection>
          <Toggle label="Withdrawal alerts" description="Notify before drug withdrawal periods end" checked={prefs.withdrawal_alerts} onChange={toggle('withdrawal_alerts')} />
          <Toggle label="Lease renewal alerts" description="Notify before grazing leases expire" checked={prefs.lease_renewal_alerts} onChange={toggle('lease_renewal_alerts')} />
          <Toggle label="Calving reminders" description="Remind about upcoming expected calving dates" checked={prefs.calving_reminders} onChange={toggle('calving_reminders')} />
          <Toggle label="Weight reminders" description="Remind to record weights on schedule" checked={prefs.weight_reminders} onChange={toggle('weight_reminders')} />
        </PanelSection>
      </Panel>

      <Panel title="DELIVERY">
        <PanelSection>
          <Toggle label="Email notifications" description="Send alert emails in addition to in-app notifications" checked={prefs.email_notifications} onChange={toggle('email_notifications')} />
        </PanelSection>
        <PanelSection>
          <p className="type-field-label mb-3" style={{ color: 'var(--text)' }}>Alert lead time</p>
          <SegmentedControl
            items={LEAD_DAY_SEGMENTS}
            value={String(prefs.alert_lead_days)}
            onChange={v => setPrefs(p => ({ ...p, alert_lead_days: Number(v) }))}
          />
        </PanelSection>
      </Panel>

      {error && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--success-fg)', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
          Saved successfully
        </p>
      )}

      <div className="flex justify-end">
        <Button intent="primary" loading={saving} onClick={handleSave}>SAVE CHANGES</Button>
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchUsers = useCallback(() => {
    fetch('/api/settings/users')
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d.data) ? d.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true); setInviteError(''); setInviteSent(false)
    try {
      const res = await fetch('/api/settings/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      })
      const d = await res.json()
      if (!res.ok) { setInviteError(d.error ?? 'Invite failed'); return }
      setInviteSent(true)
      setInviteEmail(''); setInviteName(''); setInviteRole('viewer')
      fetchUsers()
      setTimeout(() => { setShowInvite(false); setInviteSent(false) }, 2000)
    } catch { setInviteError('Connection error') }
    finally { setInviting(false) }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Remove this user? This cannot be undone.')) return
    setRevoking(id)
    try {
      await fetch(`/api/settings/users/${id}`, { method: 'DELETE' })
      fetchUsers()
    } finally { setRevoking(null) }
  }

  const roleLabel = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>{users.length} USER{users.length !== 1 ? 'S' : ''}</p>
        <Button intent="primary" size="sm" onClick={() => setShowInvite(v => !v)}>
          {showInvite ? 'CANCEL' : '+ INVITE USER'}
        </Button>
      </div>

      {showInvite && (
        <Panel title="INVITE USER">
          <PanelSection>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Rancher" required />
                </Field>
                <Field label="Email" required>
                  <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@example.com" type="email" required />
                </Field>
              </div>
              <Field label="Role">
                <Select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </Select>
              </Field>
              {inviteError && (
                <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
                  style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                  {inviteError}
                </p>
              )}
              {inviteSent && (
                <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
                  style={{ color: 'var(--success-fg)', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
                  Invite sent!
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" intent="primary" loading={inviting}>SEND INVITE</Button>
              </div>
            </form>
          </PanelSection>
        </Panel>
      )}

      {users.length === 0 ? (
        <EmptyState variant="neutral" title="No users" body="Invite your team to get started." />
      ) : (
        <Panel>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {users.map(u => (
                <TR key={u.id}>
                  <TD>{u.name}</TD>
                  <TD style={{ color: 'var(--text-muted)' }}>{u.email}</TD>
                  <TD><Chip tone="neutral" size="sm">{roleLabel(u.role)}</Chip></TD>
                  <TD>
                    <Chip tone={u.invite_accepted_at ? 'success' : 'warning'} size="sm">
                      {u.invite_accepted_at ? 'Active' : 'Pending'}
                    </Chip>
                  </TD>
                  <TD>
                    <Button
                      intent="ghost"
                      size="sm"
                      loading={revoking === u.id}
                      onClick={() => handleRevoke(u.id)}
                      style={{ color: 'var(--danger-fg)' }}
                    >
                      REMOVE
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Panel>
      )}
    </div>
  )
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

function DataTab() {
  const exports = [
    { label: 'Animals', description: 'All animals with tags, breed, status', href: '/api/export/animals' },
    { label: 'Weight history', description: 'All recorded weights by animal', href: '/api/export/weights' },
    { label: 'Health events', description: 'Health logs, treatments, withdrawals', href: '/api/export/health' },
    { label: 'Sales records', description: 'Sale transactions and proceeds', href: '/api/export/sales' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Panel title="EXPORT DATA">
        <PanelSection>
          <p className="type-body mb-4" style={{ color: 'var(--text-secondary)' }}>
            Download your data as CSV files. Exports include all records for your ranch.
          </p>
          <div className="flex flex-col gap-3">
            {exports.map(ex => (
              <div key={ex.href} className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="type-field-label" style={{ color: 'var(--text)' }}>{ex.label}</p>
                  <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{ex.description}</p>
                </div>
                <a href={ex.href} download>
                  <Button intent="secondary" size="sm">DOWNLOAD CSV</Button>
                </a>
              </div>
            ))}
          </div>
        </PanelSection>
      </Panel>
    </div>
  )
}

// ─── Custom Fields Tab ────────────────────────────────────────────────────────

function CustomTab() {
  return (
    <div className="flex flex-col gap-6">
      <ContextBanner tone="neutral">
        Custom fields are coming in a future update.
      </ContextBanner>
      <EmptyState
        variant="neutral"
        title="Custom fields"
        body="Define additional fields for your animals, health records, and more."
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'ranch' | 'account' | 'notifications' | 'users' | 'data' | 'custom'

const TABS: TabItem[] = [
  { value: 'ranch',         label: 'Ranch Profile' },
  { value: 'account',       label: 'My Account' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'users',         label: 'Users & Access' },
  { value: 'data',          label: 'Data' },
  { value: 'custom',        label: 'Custom Fields' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('ranch')

  return (
    <PageContainer>
      <PageHeader title="Settings" />
      <Tabs items={TABS} value={tab} onChange={v => setTab(v as Tab)} className="mb-6" />
      {tab === 'ranch'         && <RanchTab />}
      {tab === 'account'       && <AccountTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'users'         && <UsersTab />}
      {tab === 'data'          && <DataTab />}
      {tab === 'custom'        && <CustomTab />}
    </PageContainer>
  )
}
