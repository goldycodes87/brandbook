'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { SearchField } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'
import { WeightForm } from '@/components/animals/WeightForm'
import { apiGet } from '@/lib/fetch'

const COLOR_MAP: Record<string, string> = {
  Yellow:  '#F5C518',
  Orange:  '#F97316',
  White:   '#F3F4F6',
  Green:   '#22C55E',
  Blue:    '#3B82F6',
  Red:     '#EF4444',
  Pink:    '#EC4899',
  Purple:  '#A855F7',
  Silver:  '#9CA3AF',
  Black:   '#1F2937',
}

interface AnimalResult {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  ear_tag_color: string | null
}

export function WeightLogSheet() {
  const router = useRouter()
  const [open, setOpen]                     = useState(false)
  const [step, setStep]                     = useState<1 | 2>(1)
  const [query, setQuery]                   = useState('')
  const [results, setResults]               = useState<AnimalResult[]>([])
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalResult | null>(null)
  const [searching, setSearching]           = useState(false)
  const [saved, setSaved]                   = useState(false)

  const search = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setResults((data.data ?? []) as AnimalResult[])
    } finally {
      setSearching(false)
    }
  }

  const reset = () => {
    setOpen(false)
    setStep(1)
    setQuery('')
    setResults([])
    setSelectedAnimal(null)
    setSaved(false)
  }

  const handleSuccess = () => {
    setSaved(true)
    router.refresh()
    setTimeout(() => reset(), 1500)
  }

  return (
    <>
      <Button intent="secondary" size="sm" onClick={() => setOpen(true)}>RECORD WEIGHT</Button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) reset() }}
        >
          <div
            className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] overflow-y-auto w-full md:max-w-lg"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh', padding: '24px 16px' }}
          >
            {saved ? (
              <div className="py-8 text-center">
                <p className="type-panel-title mb-1" style={{ color: 'var(--success-fg)' }}>Weight saved!</p>
                <p className="type-body" style={{ color: 'var(--text-muted)' }}>Closing…</p>
              </div>
            ) : step === 1 ? (
              <>
                <p className="type-panel-title mb-4">Record Weight</p>
                <p className="type-field-label mb-2">Select animal</p>
                <SearchField
                  value={query}
                  onChange={e => search(e.target.value)}
                  placeholder="Search by tag number or name…"
                  autoFocus
                />
                {searching && (
                  <p className="type-helper mt-2" style={{ color: 'var(--text-muted)' }}>Searching…</p>
                )}
                {results.length > 0 && (
                  <div className="mt-2 rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {results.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                        onClick={() => { setSelectedAnimal(a); setStep(2) }}
                      >
                        {a.ear_tag_color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLOR_MAP[a.ear_tag_color] ?? '#888' }}
                          />
                        )}
                        <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)' }}>
                          {a.tag_number}
                        </span>
                        {a.name && (
                          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</span>
                        )}
                        {a.sex && (
                          <div className="ml-auto">
                            <Chip tone="neutral" size="sm">{a.sex}</Chip>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={reset} className="mt-4 type-helper" style={{ color: 'var(--text-muted)' }}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <p className="type-panel-title mb-1">Record Weight</p>
                <p className="type-helper mb-4" style={{ color: 'var(--text-muted)' }}>
                  Animal:{' '}
                  <strong style={{ color: 'var(--text)' }}>
                    #{selectedAnimal!.tag_number}{selectedAnimal!.name ? ` — ${selectedAnimal!.name}` : ''}
                  </strong>
                  <button type="button" className="ml-2" style={{ color: 'var(--accent)' }} onClick={() => setStep(1)}>
                    change
                  </button>
                </p>
                <WeightForm
                  animalId={selectedAnimal!.id}
                  onSuccess={handleSuccess}
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
