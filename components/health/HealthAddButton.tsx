'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SearchField } from '@/components/ui/Field'
import { HealthEventForm } from '@/components/health/HealthEventForm'

interface AnimalResult { id: string; tag_number: string; name: string | null }

export function HealthAddButton() {
  const [open, setOpen]             = useState(false)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<AnimalResult[]>([])
  const [animal, setAnimal]         = useState<AnimalResult | null>(null)
  const [searching, setSearching]   = useState(false)

  const search = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await fetch(`/api/animals?search=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setResults((data.data ?? []) as AnimalResult[])
    } finally {
      setSearching(false)
    }
  }

  const reset = () => {
    setOpen(false)
    setAnimal(null)
    setQuery('')
    setResults([])
  }

  return (
    <>
      <Button intent="primary" size="sm" onClick={() => setOpen(true)}>+ LOG EVENT</Button>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) reset() }}>
          <div
            className="rounded-t-[var(--radius-xl)] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh', padding: '24px 16px' }}
          >
            {!animal ? (
              <>
                <p className="type-panel-title mb-4">Log Health Event</p>
                <p className="type-field-label mb-2">Select animal</p>
                <SearchField
                  value={query}
                  onChange={e => search(e.target.value)}
                  placeholder="Search by tag number or name…"
                  autoFocus
                />
                {searching && <p className="type-helper mt-2" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
                {results.length > 0 && (
                  <div
                    className="mt-2 rounded-[var(--radius-md)] overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    {results.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAnimal(a)}
                        className="w-full text-left px-4 py-3 transition-colors"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{a.tag_number}</span>
                        {a.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 type-helper"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <p className="type-panel-title mb-1">Log Health Event</p>
                <p className="type-helper mb-4" style={{ color: 'var(--text-muted)' }}>
                  Animal: <strong style={{ color: 'var(--text)' }}>#{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}</strong>
                  <button type="button" className="ml-2" style={{ color: 'var(--accent)' }} onClick={() => setAnimal(null)}>change</button>
                </p>
                <HealthEventForm
                  animalId={animal.id}
                  onSuccess={reset}
                  onCancel={reset}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
