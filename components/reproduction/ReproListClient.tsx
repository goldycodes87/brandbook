'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusChip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { REPRO_CHIP, SEX_CHIP } from '@/components/ui/tokens'
import { ReproEventForm } from '@/components/reproduction/ReproEventForm'
import { SearchField } from '@/components/ui/Field'
import type { TabItem } from '@/components/ui/Tabs'
import { apiGet } from '@/lib/fetch'

interface AnimalResult { id: string; tag_number: string; name: string | null; sex: string | null }

type TabType = 'all' | 'bred' | 'preg_check' | 'calved' | 'weaned'

const TABS: TabItem<TabType>[] = [
  { value: 'all',        label: 'ALL' },
  { value: 'bred',       label: 'BRED' },
  { value: 'preg_check', label: 'PREG CHECK' },
  { value: 'calved',     label: 'CALVED' },
  { value: 'weaned',     label: 'WEANED' },
]

interface ReproEvent {
  id: string
  event_type: string
  event_date: string
  breed_method: string | null
  conception_method: string | null
  sire_name_text: string | null
  expected_calving_date: string | null
  preg_check_result: string | null
  weaning_weight_lbs: number | null
  notes: string | null
  animal: { id: string; tag_number: string; name: string | null; ear_tag_color: string | null; sex: string | null } | null
  sire:   { id: string; tag_number: string; name: string | null } | null
  calf:   { id: string; tag_number: string; name: string | null; sex: string | null } | null
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const EAR_TAG_COLOR_HEX: Record<string, string> = {
  yellow: '#EAB308', orange: '#F97316', red: '#EF4444',
  green: '#22C55E', blue: '#3B82F6', white: '#F1F5F9',
  pink: '#EC4899', purple: '#A855F7', black: '#1E293B',
}

function ColorDot({ color }: { color: string | null }) {
  if (!color) return null
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0"
      style={{ backgroundColor: EAR_TAG_COLOR_HEX[color] ?? '#888', border: '1px solid var(--border)' }}
    />
  )
}

function eventDetail(ev: ReproEvent): string {
  if (ev.event_type === 'bred') {
    const sireLabel = ev.sire
      ? `#${ev.sire.tag_number}${ev.sire.name ? ` ${ev.sire.name}` : ''}`
      : ev.sire_name_text ?? '—'
    return sireLabel
  }
  if (ev.event_type === 'preg_check') return ev.preg_check_result?.toUpperCase() ?? '—'
  if (ev.event_type === 'calved' && ev.calf) {
    return `Calf #${ev.calf.tag_number}${ev.calf.sex ? ` (${ev.calf.sex})` : ''}`
  }
  if (ev.event_type === 'weaned') {
    return ev.weaning_weight_lbs ? `${ev.weaning_weight_lbs} lb` : '—'
  }
  return ev.notes ?? '—'
}

export function ReproListClient({ defaultTab }: { defaultTab: string }) {
  const [tab, setTab]         = useState<TabType>((defaultTab as TabType) ?? 'all')
  const [events, setEvents]   = useState<ReproEvent[]>([])
  const [count, setCount]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(0)
  const [logOpen, setLogOpen]     = useState(false)
  const [logAnimal, setLogAnimal] = useState<AnimalResult | null>(null)
  const [logSearch, setLogSearch] = useState('')
  const [logResults, setLogResults] = useState<AnimalResult[]>([])
  const [logSearching, setLogSearching] = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const et     = tab !== 'all' ? `&event_type=${tab}` : ''
      const offset = page * 50
      const res    = await apiGet(`/api/reproduction?limit=50&offset=${offset}${et}`)
      const data   = await res.json()
      setEvents(data.data ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleTabChange = (t: TabType) => {
    setTab(t)
    setPage(0)
  }

  const searchLogAnimals = async (q: string) => {
    setLogSearch(q)
    if (!q.trim()) { setLogResults([]); return }
    setLogSearching(true)
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setLogResults(data.data ?? [])
    } finally {
      setLogSearching(false)
    }
  }

  const closeLog = () => {
    setLogOpen(false)
    setLogAnimal(null)
    setLogSearch('')
    setLogResults([])
  }

  const emptyMessages: Record<TabType, string> = {
    all:        'No reproduction events recorded yet.',
    bred:       'No breeding events recorded.',
    preg_check: 'No pregnancy checks recorded.',
    calved:     'No calving events recorded.',
    weaned:     'No weaning events recorded.',
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Tabs value={tab} onChange={handleTabChange} items={TABS} />
        <Button intent="secondary" size="sm" onClick={() => setLogOpen(true)}>+ LOG EVENT</Button>
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <EmptyState variant="neutral" title="No records" body={emptyMessages[tab]} />
      )}

      {!loading && events.length > 0 && (
        <>
          <p className="type-data-sm mb-3" style={{ color: 'var(--text-muted)' }}>{count} events</p>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {events.map(ev => {
              const animal = ev.animal as typeof ev.animal
              return (
                <div key={ev.id} className="rounded-[var(--radius-lg)] p-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {animal && <ColorDot color={animal.ear_tag_color} />}
                      {animal && (
                        <Link href={`/animals/${animal.id}`} className="type-data-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                          #{animal.tag_number}
                        </Link>
                      )}
                      <StatusChip map={REPRO_CHIP} value={ev.event_type} size="sm" />
                    </div>
                    <span className="type-helper shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.event_date)}</span>
                  </div>
                  <p className="type-helper" style={{ color: 'var(--text-secondary)' }}>{eventDetail(ev)}</p>
                  {ev.expected_calving_date && ev.event_type === 'bred' && (
                    <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Est. calving: {fmtDate(ev.expected_calving_date)}
                    </p>
                  )}
                  {ev.calf && (
                    <Link href={`/animals/${ev.calf.id}`} className="type-helper mt-1 block hover:underline" style={{ color: 'var(--accent)' }}>
                      Calf: #{ev.calf.tag_number}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Animal</TH>
                  <TH>Event</TH>
                  <TH>Date</TH>
                  <TH>Detail</TH>
                  <TH>Sire / Calf</TH>
                  <TH>Notes</TH>
                </TR>
              </THead>
              <TBody>
                {events.map(ev => {
                  const animal = ev.animal as typeof ev.animal
                  return (
                    <TR key={ev.id}>
                      <TD>
                        {animal ? (
                          <div className="flex items-center gap-1.5">
                            <ColorDot color={animal.ear_tag_color} />
                            <Link href={`/animals/${animal.id}`} className="type-data-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                              #{animal.tag_number}
                            </Link>
                            {animal.name && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{animal.name}</span>}
                          </div>
                        ) : '—'}
                      </TD>
                      <TD><StatusChip map={REPRO_CHIP} value={ev.event_type} size="sm" /></TD>
                      <TD>{fmtDate(ev.event_date)}</TD>
                      <TD>{eventDetail(ev)}</TD>
                      <TD>
                        {ev.sire ? (
                          <Link href={`/animals/${ev.sire.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                            #{ev.sire.tag_number}
                          </Link>
                        ) : ev.sire_name_text ? (
                          <span style={{ color: 'var(--text-secondary)' }}>{ev.sire_name_text}</span>
                        ) : ev.calf ? (
                          <Link href={`/animals/${ev.calf.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                            Calf #{ev.calf.tag_number}
                          </Link>
                        ) : '—'}
                      </TD>
                      <TD>{ev.notes ? ev.notes.slice(0, 40) + (ev.notes.length > 40 ? '…' : '') : '—'}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>

          {/* Pagination */}
          {count > 50 && (
            <div className="flex items-center justify-between gap-3 mt-4">
              <Button intent="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</Button>
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                {page * 50 + 1}–{Math.min((page + 1) * 50, count)} of {count}
              </span>
              <Button intent="ghost" size="sm" disabled={(page + 1) * 50 >= count} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          )}
        </>
      )}

      {/* Log Event slide-up */}
      {logOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) closeLog() }}>
          <div
            className="rounded-t-[var(--radius-xl)] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '92dvh', padding: '24px 16px' }}
          >
            {!logAnimal ? (
              <>
                <p className="type-panel-title mb-4">Log Reproduction Event</p>
                <p className="type-field-label mb-2">Select animal</p>
                <SearchField value={logSearch} onChange={e => searchLogAnimals(e.target.value)} placeholder="Search by tag or name…" autoFocus />
                {logSearching && <p className="type-helper mt-2" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
                {logResults.length > 0 && (
                  <div className="mt-2 rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {logResults.map(a => (
                      <button key={a.id} type="button" onClick={() => setLogAnimal(a)}
                        className="w-full text-left px-4 py-3 transition-colors" style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                        <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{a.tag_number}</span>
                        {a.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                        {a.sex  && <span className="type-helper ml-2 capitalize" style={{ color: 'var(--text-muted)' }}>{a.sex}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={closeLog} className="mt-4 type-helper" style={{ color: 'var(--text-muted)' }}>Cancel</button>
              </>
            ) : (
              <>
                <p className="type-panel-title mb-1">Log Reproduction Event</p>
                <p className="type-helper mb-4" style={{ color: 'var(--text-muted)' }}>
                  Animal: <strong style={{ color: 'var(--text)' }}>#{logAnimal.tag_number}{logAnimal.name ? ` — ${logAnimal.name}` : ''}</strong>
                  <button type="button" className="ml-2" style={{ color: 'var(--accent)' }} onClick={() => setLogAnimal(null)}>change</button>
                </p>
                <ReproEventForm
                  animalId={logAnimal.id}
                  animalSex={logAnimal.sex ?? 'cow'}
                  onSuccess={() => { closeLog(); fetchEvents() }}
                  onCancel={closeLog}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
