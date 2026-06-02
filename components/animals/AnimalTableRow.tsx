'use client'

import { useRouter } from 'next/navigation'
import { TR, TD } from '@/components/ui/Table'
import { StatusChip } from '@/components/ui/Chip'
import { ANIMAL_STATUS_CHIP, SEX_CHIP, getSexValue, EAR_TAG_COLOR_HEX } from '@/components/ui/tokens'
import type { AnimalListItem } from './AnimalCard'
import { BreedDisplay } from '@/components/animals/BreedDisplay'

export function AnimalTableRow({ a }: { a: AnimalListItem }) {
  const router = useRouter()
  return (
    <TR interactive onClick={() => router.push(`/animals/${a.id}`)}>
      <TD style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontWeight: 600 }}>
        <div className="flex items-center gap-1.5">
          {a.ear_tag_color && (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: EAR_TAG_COLOR_HEX[a.ear_tag_color] ?? '#888', border: '1px solid var(--border)' }}
            />
          )}
          {a.tag_number}
        </div>
      </TD>
      <TD>{a.name ?? '—'}</TD>
      <TD>{a.sex ? <StatusChip map={SEX_CHIP} value={getSexValue(a.sex, a.calf_sex)} size="sm" /> : '—'}</TD>
      <TD><BreedDisplay breeds={a.breeds} breed={a.breed} breedPercentage={a.breed_percentage} /></TD>
      <TD><StatusChip map={ANIMAL_STATUS_CHIP} value={a.status} size="sm" /></TD>
      <TD>{a.owner_display_name ?? a.owner?.name ?? '—'}</TD>
    </TR>
  )
}
