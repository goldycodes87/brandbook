'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import Link from 'next/link'
import { Check, Download, Tag, AlertTriangle, FileText, MapPin, Calendar, Plus } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/fetch'

// ─── Types ───────────────────────────────────────────────────────────────────




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

function AccountTab() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/api/settings/profile')
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
      const res = await apiPatch('/api/settings/profile', { name, phone })
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
    apiGet('/api/settings/notifications')
      .then(r => r.json())
      .then(d => { setPrefs(p => ({ ...p, ...(d.data ?? d) })); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (k: keyof NotifPrefs) => (val: boolean) => setPrefs(p => ({ ...p, [k]: val }))

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await apiPatch('/api/settings/notifications', prefs)
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
    apiGet('/api/settings/users')
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d.data) ? d.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true); setInviteError(''); setInviteSent(false)
    try {
      const res = await apiPost('/api/settings/invite', { email: inviteEmail, name: inviteName, role: inviteRole })
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
      await apiDelete(`/api/settings/users/${id}`)
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

// ─── Data Cleanup Panel ───────────────────────────────────────────────────────

interface MismatchedAnimal {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  calf_sex: string | null
}

function DataCleanupPanel() {
  const [animals, setAnimals]     = useState<MismatchedAnimal[]>([])
  const [loading, setLoading]     = useState(true)
  const [fixing, setFixing]       = useState(false)
  const [result, setResult]       = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    apiGet('/api/settings/data-cleanup')
      .then(r => r.json())
      .then(d => { setAnimals(Array.isArray(d.data) ? d.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleFixAll = async () => {
    if (!confirm(`Fix ${animals.length} animal${animals.length !== 1 ? 's' : ''}? This will update their sex to match their recorded calf_sex.`)) return
    setFixing(true); setResult(null)
    try {
      const res  = await apiPost('/api/settings/data-cleanup', { auto_fix: true })
      const json = await res.json()
      setResult(`Fixed ${json.updated} animal${json.updated !== 1 ? 's' : ''}.`)
      load()
    } catch { setResult('Error — please try again') }
    finally { setFixing(false) }
  }

  return (
    <Panel title="DATA CLEANUP" subtitle="Animals with inconsistent sex vs. calf sex records">
      <PanelSection>
        {loading ? (
          <p className="type-body" style={{ color: 'var(--text-muted)' }}>Scanning…</p>
        ) : animals.length === 0 ? (
          <ContextBanner tone="success">No sex mismatches found — data looks clean.</ContextBanner>
        ) : (
          <>
            <ContextBanner tone="warning" eyebrow={`${animals.length} MISMATCH${animals.length !== 1 ? 'ES' : ''}`}>
              These animals have a <strong>calf_sex</strong> that doesn't match their current <strong>sex</strong>. "Fix All" sets sex to match calf_sex (heifer_calf → heifer, bull_calf → bull).
            </ContextBanner>
            <div className="mt-3 flex flex-col gap-1.5">
              {animals.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-md)]"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{a.tag_number}</span>
                    {a.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                    <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>
                      sex: <strong>{a.sex}</strong> · calf_sex: <strong>{a.calf_sex}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button intent="primary" size="sm" loading={fixing} onClick={handleFixAll}>
                FIX ALL ({animals.length})
              </Button>
            </div>
          </>
        )}
        {result && (
          <p className="type-helper mt-2" style={{ color: 'var(--success-fg)' }}>{result}</p>
        )}
      </PanelSection>
    </Panel>
  )
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

function DataTab() {
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile]         = useState<File | null>(null)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [importError, setImportError] = useState('')

  const handleImport = async () => {
    if (!csvFile) return
    setImporting(true)
    setImportResult(null)
    setImportError('')
    try {
      const fd = new FormData()
      fd.append('csv', csvFile)
      const res  = await apiPost('/api/animals/bulk-import', fd)
      const json = await res.json()
      if (!res.ok) { setImportError(json.error ?? 'Import failed'); return }
      setImportResult(json)
      setCsvFile(null)
      if (csvRef.current) csvRef.current.value = ''
    } catch {
      setImportError('Connection error')
    } finally {
      setImporting(false)
    }
  }

  const exports = [
    { label: 'Animals', description: 'All animals with tags, breed, status', href: '/api/export/animals' },
    { label: 'Weight history', description: 'All recorded weights by animal', href: '/api/export/weights' },
    { label: 'Health events', description: 'Health logs, treatments, withdrawals', href: '/api/export/health' },
    { label: 'Sales records', description: 'Sale transactions and proceeds', href: '/api/export/sales' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Bulk Import */}
      <Panel title="BULK ANIMAL IMPORT">
        <PanelSection>
          <ContextBanner tone="info">
            Fill in the template and upload to import multiple animals at once.
          </ContextBanner>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <a href="/templates/animals-import-template.csv" download>
                <Button intent="ghost" size="sm" leading={<Download size={14} />}>
                  DOWNLOAD TEMPLATE
                </Button>
              </a>
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>animals-import-template.csv</span>
            </div>

            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError('') }}
            />

            {csvFile ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="type-data-sm truncate">{csvFile.name}</span>
                <button type="button" className="type-helper" style={{ color: 'var(--accent)' }} onClick={() => { setCsvFile(null); if (csvRef.current) csvRef.current.value = '' }}>change</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => csvRef.current?.click()}
                className="w-full px-4 py-5 rounded-lg border-2 border-dashed text-center"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <div className="type-field-label mb-0.5">TAP TO SELECT CSV FILE</div>
                <div className="type-helper">.csv format only</div>
              </button>
            )}

            {importError && (
              <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                {importError}
              </p>
            )}

            {importResult && (
              <ContextBanner tone={importResult.imported > 0 ? 'success' : 'warning'} eyebrow="IMPORT COMPLETE">
                <strong>{importResult.imported}</strong> animal{importResult.imported !== 1 ? 's' : ''} imported
                {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}.
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 list-disc list-inside">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </ContextBanner>
            )}

            <Button intent="primary" size="sm" disabled={!csvFile} loading={importing} onClick={handleImport}>
              IMPORT ANIMALS
            </Button>
          </div>
        </PanelSection>
      </Panel>

      {/* Export Data */}
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

      <DataCleanupPanel />
    </div>
  )
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

const DEFAULT_DASHBOARD_STATS = ['total_animals', 'cows_heifers', 'calves_born', 'active_leases']
const MAX_STATS = 4

const AVAILABLE_STATS = [
  { key: 'total_animals',      label: 'Total Animals',       Icon: Tag },
  { key: 'active_bulls',       label: 'Active Bulls',        Icon: Tag },
  { key: 'cows_heifers',       label: 'Cows & Heifers',      Icon: Tag },
  { key: 'calves',             label: 'Calves',              Icon: Tag },
  { key: 'in_withdrawal',      label: 'In Withdrawal',       Icon: AlertTriangle },
  { key: 'open_invoices',      label: 'Open Invoices',       Icon: FileText },
  { key: 'active_leases',      label: 'Active Leases',       Icon: MapPin },
  { key: 'confirmed_pregnant', label: 'Confirmed Pregnant',  Icon: Calendar },
  { key: 'expected_calvings',  label: 'Calvings (30 days)',  Icon: Calendar },
  { key: 'calves_born',        label: 'Calves Born',         Icon: Tag },
]

function DashboardTab() {
  const [saved, setSaved]         = useState<string[]>(DEFAULT_DASHBOARD_STATS)
  const [selected, setSelected]   = useState<string[]>(DEFAULT_DASHBOARD_STATS)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    apiGet('/api/settings/notifications')
      .then(r => r.json())
      .then(d => {
        const stats = (d.data?.dashboard_stats ?? d.dashboard_stats) as string[] | null
        const initial = Array.isArray(stats) && stats.length > 0 ? stats : DEFAULT_DASHBOARD_STATS
        setSaved(initial)
        setSelected(initial)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (key: string) => {
    setSelected(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= MAX_STATS) return prev
      return [...prev, key]
    })
  }

  const isDirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...saved].sort())

  const handleSave = async () => {
    setSaving(true); setError(''); setShowSaved(false)
    try {
      const res = await apiPatch('/api/settings/notifications', { dashboard_stats: selected })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setSaved(selected)
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 3000)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <Panel title="DASHBOARD STATS" subtitle="Choose up to 4 metrics to show on your dashboard">
        <div className="px-4 pb-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
            {AVAILABLE_STATS.map(({ key, label, Icon }) => {
              const isSelected = selected.includes(key)
              const isDisabled = !isSelected && selected.length >= MAX_STATS
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => toggle(key)}
                  className="relative flex flex-col items-start gap-2 rounded-[var(--radius-lg)] text-left transition-all duration-100"
                  style={{
                    padding: '12px',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-soft)' : 'var(--surface-2)',
                    opacity: isDisabled ? 0.4 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSelected && (
                    <Check
                      size={12}
                      className="absolute top-2 right-2"
                      style={{ color: 'var(--accent)' }}
                    />
                  )}
                  <Icon size={16} style={{ color: 'var(--accent)' }} />
                  <span className="type-section-label leading-tight" style={{ color: 'var(--text)' }}>{label}</span>
                </button>
              )
            })}
          </div>

          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            {selected.length} of {MAX_STATS} selected
          </p>

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}

          {showSaved && (
            <ContextBanner tone="success">Dashboard updated</ContextBanner>
          )}

          <div className="flex justify-end">
            <Button intent="primary" size="sm" loading={saving} disabled={!isDirty} onClick={handleSave}>
              SAVE DASHBOARD
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}

interface ExpenseCategory {
  id: string
  name: string
  description: string | null
}

// ─── Grazing Tab ─────────────────────────────────────────────────────────────
//
// Owners and their contracts moved to Admin → Owners. What stayed is the
// expense-category list, which belongs with Billing & Rates and moves when
// that room does.

function GrazingTab() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat]   = useState(false)

  const load = useCallback(async () => {
    const cats = await apiGet('/api/billing/expenses/categories').then(r => r.json())
    setCategories(Array.isArray(cats.data) ? cats.data : [])
  }, [])

  useEffect(() => {
    apiGet('/api/billing/expenses/categories')
      .then(r => r.json())
      .then(cats => { setCategories(Array.isArray(cats.data) ? cats.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setAddingCat(true)
    try {
      const res = await apiPost('/api/billing/expenses/categories', { name: newCatName.trim() })
      if (res.ok) {
        setNewCatName('')
        setShowAddCategory(false)
        await load()
      }
    } finally {
      setAddingCat(false)
    }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      <ContextBanner tone="info">
        Owners, contracts and portal invites now live under Settings → Admin Settings → Owners.
      </ContextBanner>

      <Panel title="EXPENSE CATEGORIES" subtitle="Categories for shared expense billing">
        <PanelSection>
          <div className="flex flex-col gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="type-field-label" style={{ color: 'var(--text)' }}>{cat.name}</p>
                  {cat.description && (
                    <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{cat.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showAddCategory ? (
            <form onSubmit={handleAddCategory} className="flex items-end gap-2 mt-3">
              <div className="flex-1">
                <Field label="Category name">
                  <Input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="e.g. Hauling"
                    autoFocus
                  />
                </Field>
              </div>
              <Button type="submit" intent="primary" size="sm" loading={addingCat}>ADD</Button>
              <Button type="button" intent="ghost" size="sm" onClick={() => setShowAddCategory(false)}>CANCEL</Button>
            </form>
          ) : (
            <Button
              intent="ghost" size="sm" className="mt-3"
              onClick={() => setShowAddCategory(true)}
              leading={<Plus size={14} />}
            >
              ADD CATEGORY
            </Button>
          )}
        </PanelSection>
      </Panel>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'account' | 'notifications' | 'users' | 'grazing' | 'data' | 'dashboard'

const TABS: TabItem[] = [
  { value: 'account',       label: 'My Account' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'users',         label: 'Users & Access' },
  { value: 'grazing',       label: 'Custom Grazing' },
  { value: 'data',          label: 'Data' },
  { value: 'dashboard',     label: 'Dashboard' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account')
  // Null until we know. Rendering the row optimistically would flash a door at
  // people who cannot open it.
  const [admin, setAdmin] = useState<{ canReachAdmin: boolean; role: string } | null>(null)

  useEffect(() => {
    let off = false
    apiGet('/api/admin/me')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!off && j) setAdmin(j) })
      .catch(() => {})
    return () => { off = true }
  }, [])

  return (
    <PageContainer>
      <PageHeader title="Settings" />

      {/* One login, one site. Anyone carrying an admin role gets the door to
          the operation's configuration here; everyone else never learns it
          exists. The section is gated server-side regardless. */}
      {admin?.canReachAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-3 px-4 py-3 rounded-lg mb-5"
          style={{ border: '1px solid var(--accent)', background: 'var(--surface-1)' }}
        >
          <span style={{ fontSize: 18 }}>🗄️</span>
          <span className="flex-1">
            <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Admin Settings
            </span>
            <span className="block type-helper" style={{ color: 'var(--text-muted)' }}>
              {admin.role === 'cpa'
                ? 'Billing and reports for the whole operation'
                : 'Ranch, people, owners, billing, defaults and data'}
            </span>
          </span>
          <span style={{ color: 'var(--accent)' }}>→</span>
        </Link>
      )}

      <Tabs items={TABS} value={tab} onChange={v => setTab(v as Tab)} className="mb-6" />
      {tab === 'account'       && <AccountTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'users'         && <UsersTab />}
      {tab === 'grazing'       && <GrazingTab />}
      {tab === 'data'          && <DataTab />}
      {tab === 'dashboard'     && <DashboardTab />}
    </PageContainer>
  )
}
