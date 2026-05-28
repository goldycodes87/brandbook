'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SearchField, Field, Input } from '@/components/ui/Field'

export interface SireResult {
  id: string
  tag_number: string
  name: string | null
  breed: string | null
}

interface SireSelectorProps {
  sireId: string | null
  sireName: string | null
  onChangeSireId: (id: string | null) => void
  onChangeSireName: (name: string | null) => void
}

export function SireSelector({ sireId, sireName, onChangeSireId, onChangeSireName }: SireSelectorProps) {
  const [mode, setMode]       = useState<'system' | 'external'>(sireId ? 'system' : 'external')
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SireResult[]>([])
  const [selected, setSelected] = useState<SireResult | null>(null)
  const [searching, setSearching] = useState(false)

  const search = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await fetch(`/api/animals?search=${encodeURIComponent(q)}&sex=bull&limit=10`)
      const data = await res.json()
      setResults((data.data ?? []) as SireResult[])
    } finally {
      setSearching(false)
    }
  }

  const selectSire = (s: SireResult) => {
    setSelected(s)
    setResults([])
    setQuery('')
    onChangeSireId(s.id)
    onChangeSireName(null)
  }

  const clearSire = () => {
    setSelected(null)
    setQuery('')
    setResults([])
    onChangeSireId(null)
    onChangeSireName(null)
  }

  const switchMode = (m: 'system' | 'external') => {
    setMode(m)
    clearSire()
  }

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        value={mode}
        onChange={v => switchMode(v as 'system' | 'external')}
        items={[
          { value: 'system',   label: 'IN SYSTEM' },
          { value: 'external', label: 'EXTERNAL' },
        ]}
        size="sm"
        block
      />

      {mode === 'system' && (
        <div>
          {selected ? (
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)]"
              style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent)' }}
            >
              <div>
                <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  #{selected.tag_number}
                </span>
                {selected.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{selected.name}</span>}
                {selected.breed && <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>· {selected.breed}</span>}
              </div>
              <button type="button" className="type-helper" style={{ color: 'var(--accent)' }} onClick={clearSire}>change</button>
            </div>
          ) : (
            <div className="relative">
              <SearchField
                value={query}
                onChange={e => search(e.target.value)}
                placeholder="Search bulls by tag or name…"
              />
              {searching && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
              {results.length > 0 && (
                <div
                  className="mt-1 rounded-[var(--radius-md)] overflow-hidden z-10 relative"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
                >
                  {results.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSire(s)}
                      className="w-full text-left px-3 py-2 transition-colors"
                      style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{s.tag_number}</span>
                      {s.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{s.name}</span>}
                      {s.breed && <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>· {s.breed}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'external' && (
        <Field label="Sire name / description">
          <Input
            value={sireName ?? ''}
            onChange={e => { onChangeSireName(e.target.value || null); onChangeSireId(null) }}
            placeholder="e.g. Herd Bull, Angus 001"
          />
        </Field>
      )}
    </div>
  )
}
