'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Calendar, AlertTriangle, Plus, RefreshCw } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import type { TabItem } from '@/components/ui/Tabs'
import { LeaseSheet, type Lease } from '@/components/leases/LeaseSheet'
import { apiGet } from '@/lib/fetch'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string | null) {
  switch (status) {
    case 'active':     return <Badge variant="success">Active</Badge>
    case 'pending':    return <Badge variant="info">Pending</Badge>
    case 'expired':    return <Badge variant="neutral">Expired</Badge>
    case 'terminated': return <Badge variant="danger">Terminated</Badge>
    default:           return <Badge variant="neutral">{status ?? 'Unknown'}</Badge>
  }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRate(lease: Lease) {
  if (lease.rate_type === 'flat_rate' && lease.flat_rate != null) {
    return `$${Number(lease.flat_rate).toLocaleString()} flat`
  }
  if (lease.rate_per_acre != null) {
    return `$${Number(lease.rate_per_acre).toFixed(2)}/acre`
  }
  return '—'
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function renewalWarning(lease: Lease) {
  const days = daysUntil(lease.end_date)
  if (days === null || lease.status !== 'active') return null
  const alertDays = lease.renewal_alert_days ?? 60
  if (days < 0) return null
  if (days <= alertDays) return days
  return null
}

// ─── Lease Card ──────────────────────────────────────────────────────────────

function LeaseCard({ lease, onClick }: { lease: Lease; onClick: () => void }) {
  const warn = renewalWarning(lease)
  const location = [lease.county, lease.state].filter(Boolean).join(', ')

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg transition-colors"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', padding: '16px' }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
            {lease.property_name}
          </p>
          {lease.landowner_name && (
            <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>
              {lease.landowner_name}
            </p>
          )}
        </div>
        {statusBadge(lease.status)}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {location && (
          <span className="flex items-center gap-1 type-helper" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={12} />
            {location}
            {lease.acreage != null && ` · ${Number(lease.acreage).toLocaleString()} ac`}
          </span>
        )}
        <span className="flex items-center gap-1 type-helper" style={{ color: 'var(--text-muted)' }}>
          <Calendar size={12} />
          {formatDate(lease.start_date)} – {formatDate(lease.end_date)}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="type-helper font-medium" style={{ color: 'var(--text)' }}>
          {formatRate(lease)}
          {lease.payment_frequency && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {' '}· {lease.payment_frequency.replace('_', '-')}
            </span>
          )}
        </span>
        {warn !== null && (
          <span className="flex items-center gap-1 type-helper" style={{ color: 'var(--warning-fg, #f59e0b)' }}>
            <AlertTriangle size={12} />
            Renews in {warn}d
          </span>
        )}
        {lease.auto_renew && (
          <span className="flex items-center gap-1 type-helper" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={12} />
            Auto-renew
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: TabItem[] = [
  { value: 'active',  label: 'Active' },
  { value: 'all',     label: 'All' },
  { value: 'expired', label: 'Expired' },
]

export default function LeasesPage() {
  const [leases, setLeases]         = useState<Lease[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('active')
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Lease | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await apiGet(`/api/leases?status=${activeTab}`)
      const json = await res.json()
      setLeases(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  const openAdd  = () => { setEditTarget(null); setSheetOpen(true) }
  const openEdit = (l: Lease) => { setEditTarget(l); setSheetOpen(true) }

  return (
    <PageContainer>
      <PageHeader
        title="Leases"
        actions={
          <Button intent="primary" size="sm" onClick={openAdd}>
            <Plus size={16} className="mr-1" />
            ADD LEASE
          </Button>
        }
      />

      <Tabs items={TABS} value={activeTab} onChange={setActiveTab} className="mb-4" />

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-lg animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : leases.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No leases"
          body={activeTab === 'active' ? 'Add your first lease to get started.' : 'No leases in this category.'}
          action={activeTab === 'active' ? <Button intent="primary" size="sm" onClick={openAdd}>Add Lease</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {leases.map(l => (
            <LeaseCard key={l.id} lease={l} onClick={() => openEdit(l)} />
          ))}
        </div>
      )}

      <LeaseSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={load}
        initialData={editTarget}
        mode={editTarget ? 'edit' : 'create'}
      />
    </PageContainer>
  )
}
