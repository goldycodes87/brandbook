'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SearchField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { SireCard } from '@/components/genetics/SireCard'
import { AddSireSheet } from '@/components/genetics/AddSireSheet'
import type { SireLibraryRecord } from '@/components/genetics/SireCard'
import { apiGet } from '@/lib/fetch'

type FilterType = 'all' | 'ai_sire' | 'owned' | 'leased'

const FILTERS = [
  { value: 'all',     label: 'ALL' },
  { value: 'ai_sire', label: 'AI SIRES' },
  { value: 'owned',   label: 'OWNED' },
  { value: 'leased',  label: 'LEASED' },
]

export default function GeneticsPage() {
  const router = useRouter()
  const [filter, setFilter]     = useState<FilterType>('all')
  const [search, setSearch]     = useState('')
  const [sires, setSires]       = useState<SireLibraryRecord[]>([])
  const [count, setCount]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [editing, setEditing]   = useState<SireLibraryRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('bull_type', filter)
      if (search.trim())    params.set('search', search.trim())
      const res  = await apiGet(`/api/genetics/sires?${params}`)
      const json = await res.json()
      setSires(json.data ?? [])
      setCount(json.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => { load() }, [load])

  return (
    <PageContainer>
      <PageHeader
        title="Sire Library"
        actions={
          <div className="flex items-center gap-2">
            <Button intent="ghost" size="sm" onClick={() => router.push('/genetics/import')}>
              IMPORT PDF
            </Button>
            <Button intent="secondary" size="sm" onClick={() => setAddOpen(true)}>
              ADD SIRE
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <SegmentedControl
          value={filter}
          onChange={v => setFilter(v as FilterType)}
          items={FILTERS}
          block size="sm"
        />
        <SearchField
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, NAAB code, stud…"
        />
      </div>

      {/* Stats */}
      {!loading && count > 0 && (
        <p className="type-helper mb-3" style={{ color: 'var(--text-muted)' }}>
          {count} sire{count !== 1 ? 's' : ''} in library
        </p>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : sires.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No sires found"
          body={search || filter !== 'all'
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
            />
          ))}
        </div>
      )}

      {/* Add sheet */}
      <AddSireSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={load}
      />

      {/* Edit sheet */}
      <AddSireSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        editSire={editing}
        onSuccess={() => { setEditing(null); load() }}
      />
    </PageContainer>
  )
}
