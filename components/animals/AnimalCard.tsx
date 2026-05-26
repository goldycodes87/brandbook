'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { ANIMAL_STATUS_CHIP, SEX_CHIP } from '@/components/ui/tokens'

interface LatestWeight {
  weight_lbs: number
  weighed_at: string
}

interface Owner {
  id: string
  name: string
}

export interface AnimalListItem {
  id: string
  tag_number: string
  name: string | null
  dob: string | null
  sex: string | null
  status: string | null
  breed: string | null
  breed_percentage: number | null
  photos: string[] | null
  owner: Owner | null
  latest_weight: LatestWeight | null
}

function calcAge(dob: string | null): string {
  if (!dob) return ''
  const ms = Date.now() - new Date(dob).getTime()
  const days = Math.floor(ms / 86400000)
  if (days < 30)  return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}yr`
}

export function AnimalCard({ animal }: { animal: AnimalListItem }) {
  const thumb = animal.photos?.[0]
  const age   = calcAge(animal.dob)
  const breed = animal.breed
    ? animal.breed_percentage && animal.breed_percentage < 100
      ? `${animal.breed_percentage}% ${animal.breed}`
      : animal.breed
    : null

  return (
    <Link
      href={`/animals/${animal.id}`}
      className="flex gap-3 p-3 rounded-[var(--radius-lg)] transition-colors duration-150"
      style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div
        className="shrink-0 rounded-[var(--radius-md)] overflow-hidden"
        style={{ width: 56, height: 56, backgroundColor: 'var(--surface-3)' }}
      >
        {thumb ? (
          <Image src={thumb} alt={animal.tag_number} width={56} height={56} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>
            🐄
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="truncate"
              style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '0.03em', color: 'var(--text)' }}
            >
              {animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
            </p>
            {breed && (
              <p className="type-data-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{breed}</p>
            )}
          </div>
          <StatusChip map={ANIMAL_STATUS_CHIP} value={animal.status} size="sm" />
        </div>

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {animal.sex && <StatusChip map={SEX_CHIP} value={animal.sex} size="sm" />}
          {age && <Chip tone="neutral" size="sm">{age}</Chip>}
          {animal.latest_weight && (
            <Chip tone="neutral" size="sm">{animal.latest_weight.weight_lbs} lb</Chip>
          )}
          {animal.owner && (
            <Chip tone="neutral" size="sm" className="truncate max-w-[8rem]">{animal.owner.name}</Chip>
          )}
        </div>
      </div>
    </Link>
  )
}
