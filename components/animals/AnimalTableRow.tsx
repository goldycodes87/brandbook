'use client'

import { useRouter } from 'next/navigation'
import { TR, TD } from '@/components/ui/Table'
import { StatusChip } from '@/components/ui/Chip'
import { ANIMAL_STATUS_CHIP, SEX_CHIP } from '@/components/ui/tokens'
import type { AnimalListItem } from './AnimalCard'

export function AnimalTableRow({ a }: { a: AnimalListItem }) {
  const router = useRouter()
  return (
    <TR interactive onClick={() => router.push(`/animals/${a.id}`)}>
      <TD style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontWeight: 600 }}>
        {a.tag_number}
      </TD>
      <TD>{a.name ?? '—'}</TD>
      <TD>{a.sex ? <StatusChip map={SEX_CHIP} value={a.sex} size="sm" /> : '—'}</TD>
      <TD>
        {a.breed
          ? a.breed_percentage && a.breed_percentage < 100
            ? `${a.breed_percentage}% ${a.breed}`
            : a.breed
          : '—'}
      </TD>
      <TD><StatusChip map={ANIMAL_STATUS_CHIP} value={a.status} size="sm" /></TD>
      <TD>{a.latest_weight ? `${a.latest_weight.weight_lbs} lb` : '—'}</TD>
      <TD>{a.owner?.name ?? '—'}</TD>
    </TR>
  )
}
