'use client'

import { useRouter } from 'next/navigation'
import { TR, TD } from '@/components/ui/Table'
import { StatusChip, Chip } from '@/components/ui/Chip'
import { ANIMAL_STATUS_CHIP, SEX_CHIP, getSexValue } from '@/components/ui/tokens'
import { EarTagDot } from '@/components/ui/EarTagDot'
import type { AnimalListItem } from './AnimalCard'
import { BreedDisplay } from '@/components/animals/BreedDisplay'

export function AnimalTableRow({ a }: { a: AnimalListItem }) {
  const router = useRouter()
  return (
    <TR interactive onClick={() => router.push(`/animals/${a.id}`)}>
      <TD style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontWeight: 600 }}>
        <div className="flex items-center gap-1.5">
          <EarTagDot color={a.ear_tag_color} size="sm" />
          {a.tag_number}
        </div>
      </TD>
      <TD>{a.name ?? '—'}</TD>
      <TD>{a.sex ? <StatusChip map={SEX_CHIP} value={getSexValue(a.sex, a.calf_sex)} size="sm" /> : '—'}</TD>
      <TD><BreedDisplay breeds={a.breeds} breed={a.breed} breedPercentage={a.breed_percentage} /></TD>
      <TD><StatusChip map={ANIMAL_STATUS_CHIP} value={a.status} size="sm" /></TD>
      <TD>
        {(a.sex === 'cow' || a.sex === 'heifer') ? (() => {
          const bs = a.breeding_status
          if (bs === 'confirmed')      return <Chip tone="success" size="sm">CONFIRMED</Chip>
          if (bs === 'bred')           return <Chip tone="info"    size="sm">BRED</Chip>
          if (bs === 'recheck')        return <Chip tone="warning" size="sm">RECHECK</Chip>
          if (bs === 'open')           return <Chip tone="warning" size="sm">OPEN</Chip>
          if (bs === 'fresh_postpartum') {
            const d = a.repro?.daysSinceCalved
            const left = d != null ? 45 - d : null
            return <Chip tone="neutral" size="sm">{left != null && left > 0 ? `OPEN IN ${left}D` : 'POSTPARTUM'}</Chip>
          }
          return <span style={{ color: 'var(--text-muted)' }}>—</span>
        })() : <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </TD>
      <TD>{a.owner_display_name ?? a.owner?.name ?? '—'}</TD>
    </TR>
  )
}
