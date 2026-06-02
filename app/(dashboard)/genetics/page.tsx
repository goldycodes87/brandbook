'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { SearchField, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { SireCard } from '@/components/genetics/SireCard'
import { AddSireSheet } from '@/components/genetics/AddSireSheet'
import { SireCompareModal } from '@/components/genetics/SireCompareModal'
import { SirePerformanceCard } from '@/components/genetics/SirePerformanceCard'
import type { SireLibraryRecord } from '@/components/genetics/SireCard'
import type { SirePerformance } from '@/app/api/genetics/performance/route'
import { apiGet } from '@/lib/fetch'

// ─── Constants ────────────────────────────────────────────────────────────────

const BREED_OPTIONS = [
  'Angus', 'Red Angus', 'Simmental', 'Hereford', 'Charolais',
  'Limousin', 'Gelbvieh', 'Brangus', 'Wagyu', 'Other',
]

const TYPE_OPTIONS = [
  { value: 'ai_sire',       label: 'AI Sire' },
  { value: 'owned',         label: 'Owned' },
  { value: 'leased',        label: 'Leased' },
  { value: 'embryo_donor',  label: 'Embryo Donor' },
]

const SOURCE_OPTIONS = [
  { value: 'manual',     label: 'My Bulls' },
  { value: 'pdf_import', label: 'PDF Import' },
  { value: 'community',  label: 'Community' },
]

const SORT_OPTIONS = [
  { value: 'name__asc',      label: 'Name A→Z' },
  { value: 'name__desc',     label: 'Name Z→A' },
  { value: 'bw__desc',       label: 'BW ↑ (highest)' },
  { value: 'bw__asc',        label: 'BW ↓ (lowest)' },
  { value: 'ww__desc',       label: 'WW ↑' },
  { value: 'ww__asc',        label: 'WW ↓' },
  { value: 'yw__desc',       label: 'YW ↑' },
  { value: 'yw__asc',        label: 'YW ↓' },
  { value: 'milk__desc',     label: 'Milk ↑' },
  { value: 'milk__asc',      label: 'Milk ↓' },
  { value: 'dollar_b__desc', label: '$B ↑ (high)' },
  { value: 'dollar_b__asc',  label: '$B ↓ (low)' },
  { value: 'used__desc',     label: 'Most Used' },
]

const SORT_LABEL: Record<string, string>   = Object.fromEntries(SORT_OPTIONS.map(o => [o.value, o.label]))
const TYPE_LABEL: Record<string, string>   = Object.fromEntries(TYPE_OPTIONS.map(o => [o.value, o.label]))
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS.map(o => [o.value, o.label]))

type GeneticsTab = 'performance' | 'library' | 'semen' | 'embryos'

const GENETICS_TABS = [
  { value: 'performance' as GeneticsTab, label: 'SIRE PERFORMANCE' },
  { value: 'library'     as GeneticsTab, label: 'SIRE LIBRARY' },
  { value: 'semen'       as GeneticsTab, label: 'SEMEN INVENTORY' },
  { value: 'embryos'     as GeneticsTab, label: 'EMBRYOS' },
]

// ─── Sire Performance Tab ─────────────────────────────────────────────────────

function SirePerformanceTab() {
  const [data, setData]       = useState<SirePerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear]       = useState('')
  const [breed, setBreed]     = useState('')

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (year)  params.set('year', year)
      if (breed) params.set('breed', breed)
      const res  = await apiGet(`/api/genetics/performance?${params}`)
      const json = await res.json()
      setData(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [year, breed])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={year} onChange={e => setYear(e.target.value)} style={{ minWidth: 130 }}>
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={breed} onChange={e => setBreed(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">All Breeds</option>
          {BREED_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No sire data yet"
          body="Record bred and calved events to see sire performance stats here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map(sire => (
            <SirePerformanceCard
              key={sire.sire_library_id ?? sire.sire_id ?? sire.sire_name}
              sire={sire}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sire Library Tab ─────────────────────────────────────────────────────────

function SireLibraryTab() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const breed  = searchParams.get('breed')  ?? ''
  const stud   = searchParams.get('stud')   ?? ''
  const type   = searchParams.get('type')   ?? ''
  const source = searchParams.get('source') ?? ''
  const sort   = searchParams.get('sort')   ?? 'name__asc'

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const [sires, setSires]   = useState<SireLibraryRecord[]>([])
  const [total, setTotal]   = useState(0)
  const [studs, setStuds]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen]     = useState(false)
  const [editing, setEditing]     = useState<SireLibraryRecord | null>(null)
  const [comparing, setComparing] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  const toggleCompare = (id: string) => {
    setComparing(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/genetics?${next}`, { scroll: false })
  }, [searchParams, router])

  useEffect(() => {
    const t = setTimeout(() => setParam('search', searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? ''
    if (urlSearch !== searchInput) setSearchInput(urlSearch)
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiGet('/api/genetics/sires?studs_only=true')
      .then(r => r.json())
      .then(d => setStuds(d.studs ?? []))
      .catch(() => {})
  }, [])

  const search = searchParams.get('search') ?? ''
  const [sortKey, sortDir] = sort.includes('__') ? sort.split('__') : [sort, 'asc']

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (breed)   params.set('breed', breed)
      if (stud)    params.set('stud', stud)
      if (type)    params.set('bull_type', type)
      if (source)  params.set('source', source)
      params.set('sort', sortKey)
      params.set('dir', sortDir)
      const res  = await apiGet(`/api/genetics/sires?${params}`)
      const json = await res.json()
      setSires(json.data ?? [])
      setTotal(json.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [search, breed, stud, type, source, sortKey, sortDir])

  useEffect(() => { load() }, [load])

  const chips = [
    breed  && { key: 'breed',  label: `Breed: ${breed}` },
    stud   && { key: 'stud',   label: `Stud: ${stud}` },
    type   && { key: 'type',   label: `Type: ${TYPE_LABEL[type] ?? type}` },
    source && { key: 'source', label: `Source: ${SOURCE_LABEL[source] ?? source}` },
    sort !== 'name__asc' && { key: 'sort', label: `Sort: ${SORT_LABEL[sort] ?? sort}` },
  ].filter(Boolean) as { key: string; label: string }[]

  const dismissChip = (key: string) => {
    if (key === 'sort') setParam('sort', '')
    else setParam(key, '')
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchField
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name, NAAB, registration…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button intent="ghost" size="sm" onClick={() => router.push('/genetics/import')}>
              IMPORT PDF
            </Button>
            <Button intent="primary" size="sm" onClick={() => setAddOpen(true)}>
              + ADD BULL
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          <Select value={breed} onChange={e => setParam('breed', e.target.value)} style={{ minWidth: 130 }}>
            <option value="">All Breeds</option>
            {BREED_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select value={stud} onChange={e => setParam('stud', e.target.value)} style={{ minWidth: 150 }}>
            <option value="">All Studs</option>
            {studs.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={type} onChange={e => setParam('type', e.target.value)} style={{ minWidth: 130 }}>
            <option value="">All Types</option>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select value={source} onChange={e => setParam('source', e.target.value)} style={{ minWidth: 130 }}>
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="type-section-label flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Sort by:</span>
          <Select value={sort} onChange={e => setParam('sort', e.target.value)} style={{ maxWidth: 200 }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={() => dismissChip(chip.key)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full type-helper transition-colors"
                style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
              >
                {chip.label}
                <X size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && (
        <p className="type-helper mb-3" style={{ color: 'var(--text-muted)' }}>
          Showing {sires.length} of {total} bull{total !== 1 ? 's' : ''}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : sires.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No sires found"
          body={search || breed || stud || type || source
            ? 'Try adjusting your filters or search.'
            : 'Add your first sire manually or import from a PDF catalog.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sires.map(sire => (
            <SireCard
              key={sire.id}
              sire={sire}
              onClick={() => setEditing(sire)}
              isComparing={comparing.includes(sire.id)}
              onToggleCompare={toggleCompare}
            />
          ))}
        </div>
      )}

      <AddSireSheet open={addOpen} onClose={() => setAddOpen(false)} onSuccess={load} />
      <AddSireSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        editSire={editing}
        onSuccess={() => { setEditing(null); load() }}
      />

      {comparing.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 lg:left-[var(--sidebar-w)]"
          style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border)', padding: '12px 16px', paddingBottom: 'calc(12px + var(--bottomnav-h))' }}
        >
          <div className="flex items-center justify-between gap-3 max-w-[80rem] mx-auto">
            <div className="flex items-center gap-2">
              <span className="type-helper" style={{ color: 'var(--text)' }}>
                {comparing.length} bull{comparing.length !== 1 ? 's' : ''} selected
              </span>
              <button type="button" className="type-helper underline" style={{ color: 'var(--text-muted)' }} onClick={() => setComparing([])}>
                Clear
              </button>
            </div>
            <div className="flex gap-2">
              <Button intent="ghost" size="sm" onClick={() => setComparing([])}>Cancel</Button>
              <Button intent="primary" size="sm" disabled={comparing.length < 2} onClick={() => setShowCompare(true)}>
                COMPARE {comparing.length} BULL{comparing.length !== 1 ? 'S' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCompare && (
        <SireCompareModal sireIds={comparing} onClose={() => setShowCompare(false)} />
      )}
    </div>
  )
}

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function GeneticsContent() {
  const [tab, setTab] = useState<GeneticsTab>('performance')

  return (
    <PageContainer>
      <PageHeader
        title="Genetics"
        actions={null}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={GENETICS_TABS}
        className="mb-6"
      />

      {tab === 'performance' && <SirePerformanceTab />}
      {tab === 'library'     && <SireLibraryTab />}
      {tab === 'semen' && (
        <EmptyState
          variant="neutral"
          title="Semen Inventory"
          body="Track your AI semen straws, tanks, and usage. Coming soon."
        />
      )}
      {tab === 'embryos' && (
        <EmptyState
          variant="neutral"
          title="Embryo Records"
          body="Track embryo flushes, transfers, and results. Coming soon."
        />
      )}
    </PageContainer>
  )
}

// ─── Page (wraps in Suspense for useSearchParams) ────────────────────────────

export default function GeneticsPage() {
  return (
    <Suspense fallback={
      <PageContainer>
        <div className="h-10 w-40 rounded animate-pulse mb-6" style={{ backgroundColor: 'var(--surface-2)' }} />
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </PageContainer>
    }>
      <GeneticsContent />
    </Suspense>
  )
}
