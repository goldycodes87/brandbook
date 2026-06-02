'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Select } from '@/components/ui/Field'
import { Table, THead, TBody, TR, TH } from '@/components/ui/Table'
import { AnimalCard } from './AnimalCard'
import { AnimalTableRow } from './AnimalTableRow'
import type { AnimalListItem } from './AnimalCard'

interface Props {
  animals: AnimalListItem[]
  currentSort: string
  currentDir: 'asc' | 'desc'
}

const COLS = [
  { key: 'tag_number', label: 'Tag' },
  { key: 'name',       label: 'Name' },
  { key: 'sex',        label: 'Sex' },
  { key: 'breed',      label: 'Breed' },
  { key: 'status',     label: 'Status' },
  { key: 'owner',      label: 'Owner' },
]

export function AnimalSortableTable({ animals, currentSort, currentDir }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [, start]    = useTransition()

  function pushSort(col: string) {
    if (!col) return
    const params = new URLSearchParams(searchParams.toString())
    if (currentSort === col) {
      params.set('dir', currentDir === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sort', col)
      params.set('dir', 'asc')
    }
    params.delete('page')
    start(() => router.push(`${pathname}?${params.toString()}`))
  }

  const mobileSort = `${currentSort || 'tag_number'}-${currentDir}`

  function pushMobileSort(val: string) {
    const [col, dir] = val.split('-')
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', col)
    params.set('dir', dir)
    params.delete('page')
    start(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <>
      {/* Mobile sort control */}
      <div className="md:hidden mb-3">
        <Select value={mobileSort} onChange={e => pushMobileSort(e.target.value)}>
          <option value="tag_number-asc">Tag (A→Z)</option>
          <option value="tag_number-desc">Tag (Z→A)</option>
          <option value="name-asc">Name (A→Z)</option>
          <option value="name-desc">Name (Z→A)</option>
          <option value="sex-asc">Sex</option>
          <option value="breed-asc">Breed (A→Z)</option>
          <option value="breed-desc">Breed (Z→A)</option>
          <option value="owner-asc">Owner (A→Z)</option>
          <option value="owner-desc">Owner (Z→A)</option>
          <option value="status-asc">Status</option>
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
        </Select>
      </div>

      {/* Mobile: card grid */}
      <div className="flex flex-col gap-2 md:hidden">
        {animals.map(a => <AnimalCard key={a.id} animal={a} />)}
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              {COLS.map(col => (
                <TH
                  key={col.label}
                  sortable={!!col.key}
                  onClick={() => pushSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.key && (
                      currentSort === col.key
                        ? currentDir === 'asc'
                          ? <ChevronUp size={11} />
                          : <ChevronDown size={11} />
                        : <ChevronsUpDown size={11} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {animals.map(a => <AnimalTableRow key={a.id} a={a} />)}
          </TBody>
        </Table>
      </div>
    </>
  )
}
