'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Chip } from '@/components/ui/Chip'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { PregCheckSheet } from '@/components/reproduction/PregCheckSheet'
import { apiGet, apiPatch } from '@/lib/fetch'

interface ReminderAnimal {
  id: string
  tag_number: string
  ear_tag_color: string | null
  name: string | null
}

interface Reminder {
  id: string
  animal_id: string | null
  reminder_type: string | null
  due_date: string
  title: string | null
  notes: string | null
  is_dismissed: boolean
  animal: ReminderAnimal | null
}

function daysDiff(due: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dueD  = new Date(due + 'T00:00:00')
  return Math.round((dueD.getTime() - today.getTime()) / 86400000)
}

function DueChip({ due }: { due: string }) {
  const diff = daysDiff(due)
  if (diff < 0)  return <Chip tone="danger" size="sm">{Math.abs(diff)}d overdue</Chip>
  if (diff === 0) return <Chip tone="danger" size="sm">TODAY</Chip>
  if (diff <= 2)  return <Chip tone="warning" size="sm">In {diff} day{diff !== 1 ? 's' : ''}</Chip>
  if (diff <= 7)  return <Chip tone="gold" size="sm">{diff} days</Chip>
  return <Chip tone="neutral" size="sm">{diff} days</Chip>
}

const REMINDER_ICON: Record<string, string> = {
  preg_check: '🐄',
  calving:    '🐣',
  recheck:    '🔄',
}

export function RemindersWidget() {
  const router = useRouter()
  const [reminders,   setReminders]   = useState<Reminder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [dismissing,  setDismissing]  = useState<Record<string, boolean>>({})
  const [pregSheet,   setPregSheet]   = useState<Reminder | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiGet('/api/reminders?upcoming=true&days=30')
      const d = await r.json()
      setReminders(d.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function dismiss(id: string) {
    setDismissing(p => ({ ...p, [id]: true }))
    try {
      await apiPatch('/api/reminders', { id, is_dismissed: true })
      setReminders(prev => prev.filter(r => r.id !== id))
    } finally { setDismissing(p => ({ ...p, [id]: false })) }
  }

  if (loading || reminders.length === 0) return null

  return (
    <Panel title="UPCOMING" subtitle={`${reminders.length} reminder${reminders.length !== 1 ? 's' : ''}`} className="mb-6">
      <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
        {reminders.map(r => {
          const icon    = REMINDER_ICON[r.reminder_type ?? ''] ?? '📋'
          const animal  = r.animal
          return (
            <div key={r.id} className="flex items-center gap-3 py-3 px-1 first:pt-1 last:pb-1">
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.title ?? r.reminder_type}</p>
                {animal && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <EarTagDot color={animal.ear_tag_color} size="sm" />
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>#{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <DueChip due={r.due_date} />
                {r.reminder_type === 'preg_check' && animal && (
                  <Button intent="primary" size="sm" onClick={() => setPregSheet(r)}>LOG PREG CHECK</Button>
                )}
                <Button intent="ghost" size="sm" loading={dismissing[r.id]} onClick={() => dismiss(r.id)}>DISMISS</Button>
              </div>
            </div>
          )
        })}
      </div>

      {pregSheet?.animal && (
        <PregCheckSheet
          isOpen
          onClose={() => setPregSheet(null)}
          animal={pregSheet.animal}
          reminderId={pregSheet.id}
          onSuccess={() => { setPregSheet(null); load() }}
        />
      )}
    </Panel>
  )
}
