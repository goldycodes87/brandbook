'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Pencil } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import type { TabItem } from '@/components/ui/Tabs'
import { LeaseSheet, type Lease } from '@/components/leases/LeaseSheet'
import { LeaseBillingTab } from '@/components/leases/LeaseBillingTab'
import { LeaseAnimalsTab } from '@/components/leases/LeaseAnimalsTab'

const TABS: TabItem[] = [
  { value: 'billing', label: 'Billing' },
  { value: 'details', label: 'Details' },
  { value: 'animals', label: 'Animals' },
  { value: 'aum',     label: 'AUM' },
  { value: 'history', label: 'History' },
]

function statusBadge(status: string | null) {
  switch (status) {
    case 'active':     return <Badge variant="success">Active</Badge>
    case 'pending':    return <Badge variant="info">Pending</Badge>
    case 'expired':    return <Badge variant="neutral">Expired</Badge>
    case 'terminated': return <Badge variant="danger">Terminated</Badge>
    default:           return null
  }
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: 'var(--text)', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

function DetailsTab({ lease, onEdit }: { lease: Lease; onEdit: () => void }) {
  const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const fmtRate = () => {
    const rt = lease.rate_type
    if (rt === 'per_head' && lease.rate_per_head) return `$${lease.rate_per_head}/head/month`
    if (rt === 'per_acre' && lease.rate_per_acre) return `$${lease.rate_per_acre}/acre/year`
    if (rt === 'flat' && lease.flat_rate) return `$${lease.flat_rate}/month flat`
    if (rt === 'per_aum' && lease.rate_per_aum) return `$${lease.rate_per_aum}/AUM/month`
    return null
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-lg p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="type-section-label" style={{ color: 'var(--text)' }}>LEASE DETAILS</p>
          <Button intent="ghost" size="sm" onClick={onEdit}><Pencil size={12} className="mr-1" />EDIT</Button>
        </div>
        <DetailRow label="Landowner" value={lease.landowner_name} />
        <DetailRow label="Email" value={lease.landowner_email} />
        <DetailRow label="Phone" value={lease.landowner_phone} />
        <DetailRow label="Acreage" value={lease.acreage != null ? `${Number(lease.acreage).toLocaleString()} acres` : null} />
        <DetailRow label="AUM Capacity" value={lease.total_aum_capacity != null ? String(lease.total_aum_capacity) : null} />
        <DetailRow label="County" value={[lease.county, lease.state].filter(Boolean).join(', ')} />
        <DetailRow label="Start date" value={fmtDate(lease.start_date)} />
        <DetailRow label="End date" value={fmtDate(lease.end_date)} />
        <DetailRow label="Rate" value={fmtRate()} />
        <DetailRow label="Payment" value={lease.payment_frequency?.replace('_', '-')} />
        <DetailRow label="Auto-renew" value={lease.auto_renew ? 'Yes' : null} />
        <DetailRow label="Parcel IDs" value={lease.parcel_ids?.join(', ')} />
        <DetailRow label="Legal description" value={lease.legal_description} />
        {lease.notes && (
          <div className="pt-2">
            <p className="type-helper mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{lease.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lease, setLease]       = useState<Lease | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab]           = useState('billing')
  const [editOpen, setEditOpen] = useState(false)

  const loadLease = async () => {
    try {
      const res  = await fetch(`/api/leases/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      const json = await res.json()
      setLease(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLease() }, [id])

  if (loading) {
    return (
      <PageContainer>
        <div className="h-8 w-48 rounded animate-pulse mb-4" style={{ background: 'var(--surface-2)' }} />
        <div className="h-64 rounded-lg animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }} />
      </PageContainer>
    )
  }

  if (notFound || !lease) {
    return (
      <PageContainer>
        <EmptyState variant="neutral" title="Lease not found" body="This lease may have been deleted." />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Back + header */}
      <div className="flex items-start gap-3 mb-4">
        <Link href="/leases" className="flex items-center gap-1 type-helper mt-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={14} />
          Leases
        </Link>
      </div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{lease.property_name}</h1>
          {lease.landowner_name && (
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{lease.landowner_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusBadge(lease.status)}
          <Button intent="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={12} className="mr-1" />EDIT
          </Button>
        </div>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} className="my-4" />

      {tab === 'billing' && <LeaseBillingTab leaseId={id} lease={lease} />}
      {tab === 'details' && <DetailsTab lease={lease} onEdit={() => setEditOpen(true)} />}
      {tab === 'animals' && <LeaseAnimalsTab leaseId={id} leaseName={lease.property_name || 'this lease'} />}
      {tab === 'aum'     && <EmptyState variant="neutral" title="AUM Tracking" body="AUM records coming soon." />}
      {tab === 'history' && <EmptyState variant="neutral" title="History" body="Payment and change history coming soon." />}

      <LeaseSheet
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { loadLease(); setEditOpen(false) }}
        initialData={lease}
        mode="edit"
      />
    </PageContainer>
  )
}
