'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { SearchField, Select } from '@/components/ui/Field'

export function AnimalFilters() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex-1 min-w-[180px]">
        <SearchField
          placeholder="Search tag or name…"
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => update('search', e.target.value)}
        />
      </div>
      <Select
        value={searchParams.get('status') ?? ''}
        onChange={e => update('status', e.target.value)}
        style={{ minWidth: 130 }}
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="sold">Sold</option>
        <option value="deceased">Deceased</option>
        <option value="transferred">Transferred</option>
      </Select>
      <Select
        value={searchParams.get('sex') ?? ''}
        onChange={e => update('sex', e.target.value)}
        style={{ minWidth: 120 }}
      >
        <option value="">All sexes</option>
        <option value="bull">Bull</option>
        <option value="cow">Cow</option>
        <option value="heifer">Heifer</option>
        <option value="steer">Steer</option>
        <option value="calf">Calf</option>
      </Select>
    </div>
  )
}
