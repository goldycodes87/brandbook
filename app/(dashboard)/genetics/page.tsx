'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchField, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { SireCard } from '@/components/genetics/SireCard'
import { AddSireSheet } from '@/components/genetics/AddSireSheet'
import type { SireLibraryRecord } from '@/components/genetics/SireCard'
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

const SORT_LABEL: Record<string, string> = Object.fromEntries(SORT_OPTIONS.map(o => [o.value, o.label]))
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(o => [o.value, o.label]))
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS.map(o => [o.value, o.label]))

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function GeneticsContent() {
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
  const [addOpen, setAddOpen]   = useState(false)
  const [editing, setEditing]   = useState<SireLibraryRecord | null>(null)

  // Helper: update a single URL param (empty string removes it)
  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/genetics?${next}`, { scroll: false })
  }, [searchParams, router])

  // Debounce search input → URL
  useEffect(() => {
    const t = setTimeout(() => setParam('search', searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync input when URL param changes externally (e.g. chip dismiss)
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? ''
    if (urlSearch !== searchInput) setSearchInput(urlSearch)
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load distinct studs once
  useEffect(() => {
    apiGet('/api/genetics/sires?studs_only=true')
      .then(r => r.json())
      .then(d => setStuds(d.studs ?? []))
      .catch(() => {})
  }, [])

  // Load sires whenever URL params change
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

  // Active filter chips
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
    <PageContainer>
      <PageHeader
        title="Sire Library"
        actions={
          <div className="flex items-center gap-2">
            <Button intent="ghost" size="sm" onClick={() => router.push('/genetics/import')}>
              IMPORT PDF
            </Button>
            <Button intent="primary" size="sm" onClick={() => setAddOpen(true)}>
              + ADD BULL
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 mb-4">
        {/* Row 1: search + add */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchField
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name, NAAB, registration…"
            />
          </div>
        </div>

        {/* Row 2: filters (scroll on mobile) */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          <Select
            value={breed}
            onChange={e => setParam('breed', e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="">All Breeds</option>
            {BREED_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>

          <Select
            value={stud}
            onChange={e => setParam('stud', e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Studs</option>
            {studs.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>

          <Select
            value={type}
            onChange={e => setParam('type', e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <Select
            value={source}
            onChange={e => setParam('source', e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        {/* Row 3: sort */}
        <div className="flex items-center gap-2">
          <span className="type-section-label flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Sort by:</span>
          <Select
            value={sort}
            onChange={e => setParam('sort', e.target.value)}
            style={{ maxWidth: 200 }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={() => dismissChip(chip.key)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full type-helper transition-colors"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--accent)',
                }}
              >
                {chip.label}
                <X size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="type-helper mb-3" style={{ color: 'var(--text-muted)' }}>
          Showing {sires.length} of {total} bull{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Cards */}
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
            <SireCard key={sire.id} sire={sire} onClick={() => setEditing(sire)} />
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
