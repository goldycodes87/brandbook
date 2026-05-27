'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Select } from '@/components/ui/Field'

export function HealthFilters() {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()
  const [, startT] = useTransition()

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    startT(() => router.push(`${pathname}?${next.toString()}`))
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Select
        value={params.get('event_type') ?? ''}
        onChange={e => update('event_type', e.target.value)}
        style={{ width: 160 }}
      >
        <option value="">All types</option>
        <option value="treatment">Treatment</option>
        <option value="vaccine">Vaccine</option>
        <option value="vet_visit">Vet visit</option>
        <option value="illness">Illness</option>
        <option value="bcs_log">BCS log</option>
      </Select>
      <Select
        value={params.get('in_withdrawal') ?? ''}
        onChange={e => update('in_withdrawal', e.target.value)}
        style={{ width: 180 }}
      >
        <option value="">All animals</option>
        <option value="true">In withdrawal</option>
      </Select>
    </div>
  )
}
