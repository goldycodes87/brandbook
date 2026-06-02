'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { HEALTH_EVENT_CHIP, WITHDRAWAL_CHIP } from '@/components/ui/tokens'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { HealthEventForm, type HealthEventData } from '@/components/health/HealthEventForm'
import { apiGet } from '@/lib/fetch'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface HealthEvent extends HealthEventData {
  id: string
  animal: { id: string; tag_number: string; name: string | null; ear_tag_color?: string | null } | null
}

export function HealthListClient() {
  const sp = useSearchParams()
  const [events, setEvents]     = useState<HealthEvent[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<HealthEvent | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sp.get('event_type'))    params.set('event_type', sp.get('event_type')!)
      if (sp.get('in_withdrawal')) params.set('in_withdrawal', sp.get('in_withdrawal')!)
      const res  = await apiGet(`/api/health?${params}`)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : (data.data ?? []))
    } finally {
      setLoading(false)
    }
  }, [sp])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  if (loading) return (
    <div className="flex flex-col gap-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
      ))}
    </div>
  )

  if (!events.length) return (
    <EmptyState variant="action" title="No health events found" body="Log a health event to get started." />
  )

  const rowStyle = {
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  }

  return (
    <>
      <p className="type-data-sm mb-3" style={{ color: 'var(--text-muted)' }}>{events.length} events</p>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {events.map(ev => {
          const wd = ev.withdrawal_clear_date
          const inWd = wd && new Date(wd) > new Date()
          const animal = ev.animal
          return (
            <div key={ev.id}
              className="rounded-[var(--radius-lg)] p-4"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => setEditing(ev)}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex gap-2 flex-wrap">
                  <StatusChip map={HEALTH_EVENT_CHIP} value={ev.event_type} size="sm" />
                  {wd && <StatusChip map={WITHDRAWAL_CHIP} value={inWd ? 'active' : 'clear'} size="sm" />}
                </div>
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.event_date)}</span>
              </div>
              {animal && (
                <div className="flex items-center gap-1.5">
                  <EarTagDot color={animal.ear_tag_color} size="sm" />
                  <p className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>
                    #{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
                  </p>
                </div>
              )}
              {ev.drug_name && <p className="type-helper mt-1" style={{ color: 'var(--text-secondary)' }}>{ev.drug_name}</p>}
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
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Drug / Notes</TH>
              <TH>Withdrawal</TH>
              <TH>By</TH>
            </TR>
          </THead>
          <TBody>
            {events.map(ev => {
              const wd = ev.withdrawal_clear_date
              const inWd = wd && new Date(wd) > new Date()
              const animal = ev.animal
              return (
                <TR key={ev.id} style={rowStyle}
                  onClick={() => setEditing(ev)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  <TD>
                    {animal ? (
                      <div className="flex items-center gap-1.5" onClick={e => { e.stopPropagation() }}>
                        <EarTagDot color={animal.ear_tag_color} size="sm" />
                        <Link href={`/animals/${animal.id}`} className="type-data-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                          #{animal.tag_number}
                        </Link>
                        {animal.name && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{animal.name}</span>}
                      </div>
                    ) : '—'}
                  </TD>
                  <TD>{fmtDate(ev.event_date)}</TD>
                  <TD><StatusChip map={HEALTH_EVENT_CHIP} value={ev.event_type} size="sm" /></TD>
                  <TD>
                    {ev.drug_name ?? '—'}
                    {ev.dose_amount ? ` ${ev.dose_amount}${ev.dose_unit ? ' ' + ev.dose_unit : ''}` : ''}
                  </TD>
                  <TD>
                    {wd ? <StatusChip map={WITHDRAWAL_CHIP} value={inWd ? 'active' : 'clear'} size="sm" /> : '—'}
                  </TD>
                  <TD>{ev.administered_by ?? '—'}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </div>

      {/* Edit sheet */}
      {editing && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}
        >
          <div className="rounded-t-[var(--radius-xl)] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '92dvh', padding: '24px 16px' }}>
            <p className="type-panel-title mb-4">Edit Health Event</p>
            <HealthEventForm
              animalId={editing.animal?.id ?? ''}
              eventId={editing.id}
              initialData={editing}
              mode="edit"
              onSuccess={() => { setEditing(null); fetchEvents() }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}
