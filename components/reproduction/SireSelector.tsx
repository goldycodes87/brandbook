'use client'

import { useState, useRef } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SearchField, Field, Input } from '@/components/ui/Field'
import { apiGet } from '@/lib/fetch'

export interface SireResult {
  id: string
  tag_number: string
  name: string | null
  breed: string | null
}

export interface SireLibraryResult {
  id: string
  bull_name: string
  breed: string | null
  naab_code: string | null
  stud: string | null
  bull_type: string
  epd_dollar_b: number | null
  epd_bw: number | null
  epd_ww: number | null
}

type Mode = 'system' | 'library' | 'external'

interface SireSelectorProps {
  sireId: string | null
  sireName: string | null
  sireLibraryId?: string | null
  onChangeSireId: (id: string | null) => void
  onChangeSireName: (name: string | null) => void
  onChangeSireLibraryId?: (id: string | null) => void
  onChangeSireBreed?: (breed: string | null) => void
  initialSystem?: SireResult | null
  initialLibrary?: SireLibraryResult | null
}

export function SireSelector({
  sireId, sireName, sireLibraryId,
  onChangeSireId, onChangeSireName, onChangeSireLibraryId, onChangeSireBreed,
  initialSystem, initialLibrary,
}: SireSelectorProps) {
  const initMode: Mode = sireId ? 'system' : sireLibraryId ? 'library' : 'external'
  const [mode, setMode]             = useState<Mode>(initMode)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<(SireResult | SireLibraryResult)[]>([])
  const [selectedSystem, setSelectedSystem]   = useState<SireResult | null>(initialSystem ?? null)
  const [selectedLibrary, setSelectedLibrary] = useState<SireLibraryResult | null>(initialLibrary ?? null)
  const [searching, setSearching]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchSystem = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(q)}&sex=bull&limit=10`)
      const data = await res.json()
      setResults((data.data ?? []) as SireResult[])
    } finally { setSearching(false) }
  }

  const searchLibrary = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await apiGet(`/api/genetics/sires/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } finally { setSearching(false) }
  }

  const handleQueryChange = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (mode === 'system') searchSystem(q)
      else if (mode === 'library') searchLibrary(q)
    }, 300)
  }

  const clearAll = () => {
    setSelectedSystem(null)
    setSelectedLibrary(null)
    setQuery('')
    setResults([])
    onChangeSireId(null)
    onChangeSireName(null)
    onChangeSireLibraryId?.(null)
    onChangeSireBreed?.(null)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    clearAll()
  }

  const selectSystem = (s: SireResult) => {
    setSelectedSystem(s)
    setResults([])
    setQuery('')
    onChangeSireId(s.id)
    onChangeSireName(null)
    onChangeSireLibraryId?.(null)
    onChangeSireBreed?.(s.breed ?? null)
  }

  const selectLibrary = (s: SireLibraryResult) => {
    setSelectedLibrary(s)
    setResults([])
    setQuery('')
    onChangeSireId(null)
    onChangeSireName(s.bull_name)
    onChangeSireLibraryId?.(s.id)
    onChangeSireBreed?.(s.breed ?? null)
  }

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        value={mode}
        onChange={v => switchMode(v as Mode)}
        items={[
          { value: 'system',   label: 'IN SYSTEM' },
          { value: 'library',  label: 'LIBRARY' },
          { value: 'external', label: 'EXTERNAL' },
        ]}
        size="sm"
        block
      />

      {mode === 'system' && (
        <div>
          {selectedSystem ? (
            <SelectedPill
              label={`#${selectedSystem.tag_number}${selectedSystem.name ? ` · ${selectedSystem.name}` : ''}`}
              sub={selectedSystem.breed ?? undefined}
              onClear={clearAll}
            />
          ) : (
            <SearchDropdown
              query={query}
              onChange={handleQueryChange}
              searching={searching}
              placeholder="Search bulls by tag or name…"
              results={results}
              renderRow={r => {
                const s = r as SireResult
                return (
                  <button type="button" onClick={() => selectSystem(s)} className="w-full text-left px-3 py-2 transition-colors" style={{ borderTop: '1px solid var(--border)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                    <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{s.tag_number}</span>
                    {s.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{s.name}</span>}
                    {s.breed && <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>· {s.breed}</span>}
                  </button>
                )
              }}
            />
          )}
        </div>
      )}

      {mode === 'library' && (
        <div>
          {selectedLibrary ? (
            <SelectedPill
              label={selectedLibrary.bull_name}
              sub={[selectedLibrary.naab_code, selectedLibrary.breed, selectedLibrary.stud].filter(Boolean).join(' · ') || undefined}
              onClear={clearAll}
            />
          ) : (
            <SearchDropdown
              query={query}
              onChange={handleQueryChange}
              searching={searching}
              placeholder="Search sire library by name or NAAB…"
              results={results}
              renderRow={r => {
                const s = r as SireLibraryResult
                return (
                  <button type="button" onClick={() => selectLibrary(s)} className="w-full text-left px-3 py-2 transition-colors" style={{ borderTop: '1px solid var(--border)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                    <div className="type-data-sm font-semibold" style={{ color: 'var(--text)' }}>{s.bull_name}</div>
                    <div className="type-helper" style={{ color: 'var(--text-muted)' }}>
                      {[s.naab_code, s.breed, s.stud].filter(Boolean).join(' · ')}
                      {s.epd_dollar_b != null && <span style={{ color: 'var(--accent)' }}> · $B {s.epd_dollar_b > 0 ? '+' : ''}{s.epd_dollar_b.toFixed(1)}</span>}
                    </div>
                  </button>
                )
              }}
            />
          )}
        </div>
      )}

      {mode === 'external' && (
        <Field label="Sire name / description">
          <Input
            value={sireName ?? ''}
            onChange={e => { onChangeSireName(e.target.value || null); onChangeSireId(null); onChangeSireLibraryId?.(null) }}
            placeholder="e.g. Herd Bull, Angus 001"
          />
        </Field>
      )}
    </div>
  )
}

interface SelectedPillProps {
  label: string
  sub?: string
  onClear: () => void
}

function SelectedPill({ label, sub, onClear }: SelectedPillProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)]"
      style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent)' }}
    >
      <div>
        <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>{label}</span>
        {sub && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
      <button type="button" className="type-helper" style={{ color: 'var(--accent)' }} onClick={onClear}>change</button>
    </div>
  )
}

interface SearchDropdownProps {
  query: string
  onChange: (q: string) => void
  searching: boolean
  placeholder: string
  results: unknown[]
  renderRow: (r: unknown) => React.ReactNode
}

function SearchDropdown({ query, onChange, searching, placeholder, results, renderRow }: SearchDropdownProps) {
  return (
    <div className="relative">
      <SearchField
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {searching && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
      {results.length > 0 && (
        <div
          className="mt-1 rounded-[var(--radius-md)] overflow-hidden z-10 relative"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
        >
          {results.map((r, i) => <div key={i}>{renderRow(r)}</div>)}
        </div>
      )}
    </div>
  )
}
