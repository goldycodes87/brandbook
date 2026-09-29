'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiGet } from '@/lib/fetch'

/**
 * The ranch year, on one screen.
 *
 * Reminders were a flat list with a thirty-day window on the dashboard, which
 * is fine for "preg check #41 on Tuesday" and no use at all for planning a
 * season — calving is eight months out, and until now that was invisible
 * until late March.
 *
 * Phone gets the agenda and desktop gets the grid, because those are what each
 * is for: standing in a corral you want to know what is next, and sitting down
 * you want to see the shape of the month.
 */

type Kind = 'calving' | 'calving_watch' | 'preg_check' | 'reminder' | 'withdrawal' | 'lease'

interface RanchEvent {
  id: string
  kind: Kind
  date: string
  title: string
  tag: string | null
  href: string | null
}

const KIND_STYLE: Record<Kind, { dot: string; label: string }> = {
  calving:      { dot: 'var(--accent)',     label: 'Due to calve' },
  calving_watch:{ dot: 'var(--gold-fg)',    label: 'Start watching — due in 14 days' },
  preg_check: { dot: 'var(--info-fg)',      label: 'Preg check' },
  reminder:   { dot: 'var(--text-muted)',   label: 'Reminder' },
  withdrawal: { dot: 'var(--warning-fg)',   label: 'Withdrawal clears' },
  lease:      { dot: 'var(--success-fg)',   label: 'Lease' },
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Monday-first grid covering the whole month plus its ragged edges. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1))
  const lead  = (first.getUTCDay() + 6) % 7
  const start = new Date(first); start.setUTCDate(start.getUTCDate() - lead)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + i); return d
  })
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const [year,  setYear]  = useState(today.getUTCFullYear())
  const [month, setMonth] = useState(today.getUTCMonth())
  const [events, setEvents] = useState<RanchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(iso(today))

  const grid = useMemo(() => monthGrid(year, month), [year, month])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The grid's own edges, so the leading and trailing days are populated
      // rather than looking empty by accident.
      const r = await apiGet(`/api/calendar/events?start=${iso(grid[0])}&end=${iso(grid[41])}`)
      const d = await r.json()
      setEvents(d.data ?? [])
    } finally { setLoading(false) }
  }, [grid])

  useEffect(() => { load() }, [load])

  const byDay = useMemo(() => {
    const m = new Map<string, RanchEvent[]>()
    for (const e of events) {
      const list = m.get(e.date) ?? []
      list.push(e)
      m.set(e.date, list)
    }
    return m
  }, [events])

  const step = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1))
    setYear(d.getUTCFullYear()); setMonth(d.getUTCMonth()); setSelected(null)
  }

  const inMonth = (d: Date) => d.getUTCMonth() === month
  const todayIso = iso(today)
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : []

  /** Everything ahead, for the phone — a month grid on a phone is confetti. */
  const agenda = useMemo(() => {
    const ahead = events.filter(e => e.date >= todayIso)
    const groups = new Map<string, RanchEvent[]>()
    for (const e of ahead) {
      const list = groups.get(e.date) ?? []
      list.push(e); groups.set(e.date, list)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [events, todayIso])

  return (
    <PageContainer>
      <PageHeader
        eyebrow="THE YEAR"
        title="CALENDAR"
        subtitle="Calving, preg checks, withdrawals and anything you asked to be reminded of"
        actions={
          <div className="flex items-center gap-1">
            <Button intent="ghost" size="sm" onClick={() => step(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </Button>
            <span className="type-panel-title px-2 whitespace-nowrap" style={{ minWidth: '9rem', textAlign: 'center' }}>
              {MONTHS[month]} {year}
            </span>
            <Button intent="ghost" size="sm" onClick={() => step(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />

      {/* ── Phone: agenda ─────────────────────────────────────────────── */}
      <div className="lg:hidden">
        {loading ? (
          <p className="type-body py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : agenda.length === 0 ? (
          <EmptyState
            variant="neutral"
            title="Nothing ahead this month"
            body="Move forward a month, or log a breeding and the due date lands here on its own."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {agenda.map(([date, items]) => (
              <Panel key={date} padding="none">
                <div className="px-4 py-2.5 flex items-baseline gap-2"
                     style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                  <span className="type-panel-title">
                    {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US',
                      { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </span>
                  {date === todayIso && (
                    <span className="type-helper" style={{ color: 'var(--accent)' }}>today</span>
                  )}
                </div>
                {items.map(e => <EventRow key={e.id} event={e} />)}
              </Panel>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop: month grid ───────────────────────────────────────── */}
      <div className="hidden lg:block">
        <Panel padding="none">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DOW.map(d => (
              <div key={d} className="type-section-label px-2 py-2 text-center"
                   style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                {d}
              </div>
            ))}
            {grid.map(d => {
              const key = iso(d)
              const items = byDay.get(key) ?? []
              const isToday = key === todayIso
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className="text-left p-2 min-h-[6rem] transition-colors"
                  style={{
                    borderRight:  '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                    background:   selected === key ? 'var(--surface-2)' : 'transparent',
                    opacity:      inMonth(d) ? 1 : 0.35,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full text-xs"
                    style={{
                      width: 22, height: 22,
                      fontFamily: 'var(--font-mono)',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      color:      isToday ? '#fff' : 'var(--text-secondary)',
                      fontWeight: isToday ? 700 : 400,
                    }}
                  >
                    {d.getUTCDate()}
                  </span>
                  <span className="flex flex-col gap-1 mt-1">
                    {items.slice(0, 3).map(e => (
                      <span key={e.id} className="flex items-center gap-1.5 truncate">
                        <i style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_STYLE[e.kind].dot, flexShrink: 0 }} />
                        <span className="type-helper truncate" style={{ color: 'var(--text-secondary)' }}>
                          {e.tag ?? e.title}
                        </span>
                      </span>
                    ))}
                    {items.length > 3 && (
                      <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                        +{items.length - 3} more
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>

        {selected && (
          <Panel
            className="mt-4"
            padding="none"
            title={new Date(`${selected}T00:00:00Z`).toLocaleDateString('en-US',
              { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            subtitle={`${selectedEvents.length} item${selectedEvents.length === 1 ? '' : 's'}`}
          >
            {selectedEvents.length === 0 ? (
              <p className="type-body px-4 py-4" style={{ color: 'var(--text-muted)' }}>Nothing on.</p>
            ) : (
              selectedEvents.map(e => <EventRow key={e.id} event={e} />)
            )}
          </Panel>
        )}
      </div>

      <SubscribeNote />
    </PageContainer>
  )
}

function EventRow({ event }: { event: RanchEvent }) {
  const style = KIND_STYLE[event.kind]
  const body = (
    <span className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <i style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm" style={{ color: 'var(--text)' }}>{event.title}</span>
        <span className="block type-helper" style={{ color: 'var(--text-muted)' }}>
          {event.tag ? `${event.tag} · ` : ''}{style.label}
        </span>
      </span>
      {event.href && <span style={{ color: 'var(--accent)' }}>→</span>}
    </span>
  )
  return event.href ? <Link href={event.href} className="block">{body}</Link> : body
}

/**
 * The iCal feed has existed for weeks and nothing in the app ever mentioned
 * it, so nobody could subscribe to something they did not know was there.
 */
function SubscribeNote() {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiGet('/api/settings/calendar-feed')
      .then(r => r.json())
      .then(d => setUrl(d.url ?? null))
      .catch(() => {})
  }, [])

  if (!url) return null

  return (
    <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
         style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}>
      <CalendarDays size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Put this on your phone
        </span>
        <span className="block type-helper truncate" style={{ color: 'var(--text-muted)' }}>
          Subscribe in Apple or Google Calendar and it keeps itself up to date
        </span>
      </span>
      <Button
        intent="secondary"
        size="sm"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }).catch(() => {})
        }}
      >
        {copied ? 'COPIED' : 'COPY LINK'}
      </Button>
    </div>
  )
}
