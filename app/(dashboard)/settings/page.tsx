'use client'

import { useState, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tabs } from '@/components/ui/Tabs'
import type { TabItem } from '@/components/ui/Tabs'
import Link from 'next/link'
import { Check, Tag, AlertTriangle, FileText, MapPin, Calendar } from 'lucide-react'
import { apiGet, apiPatch } from '@/lib/fetch'
import { PasswordPanel } from '@/components/settings/PasswordPanel'

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

      {/* Outside the profile form on purpose: a password save must not ride
          along with a name change, and pressing Enter in a password field
          must not submit the form above it. */}
      <PasswordPanel />
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


// ─── Dashboard Tab ────────────────────────────────────────────────────────────

// Keep in step with DEFAULT_STATS in app/(dashboard)/dashboard/page.tsx — the
// two lists have drifted before, which shows up as a stat you can pick here
// that the dashboard renders as nothing.
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'account' | 'notifications' | 'dashboard'

const TABS: TabItem[] = [
  { value: 'account',       label: 'My Account' },
  { value: 'notifications', label: 'Notifications' },
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
      {/* A plain anchor, not <Link>: this crosses from the (dashboard) route
          group into (admin), which is a different layout tree. A client-side
          navigation across that boundary asks the bundle already in memory for
          a route it may not know — and in an installed PWA holding a build
          from before /admin existed, that is a 404 on a page that plainly
          exists on the server. Same reason CLAUDE.md says window.location.href
          over router.push. A hard load always gets the current app. */}
      {admin?.canReachAdmin && (
        <a
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
        </a>
      )}

      <Tabs items={TABS} value={tab} onChange={v => setTab(v as Tab)} className="mb-6" />
      {tab === 'account'       && <AccountTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'dashboard'     && <DashboardTab />}
    </PageContainer>
  )
}
