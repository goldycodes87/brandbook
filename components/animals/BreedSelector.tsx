'use client'

import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

export interface BreedEntry {
  breed: string
  pct: number
}

const COMMON_BREEDS = [
  'Angus', 'Hereford', 'Simmental', 'Charolais', 'Limousin',
  'Gelbvieh', 'Brahman', 'Brangus', 'Beefmaster', 'Longhorn',
  'Shorthorn', 'Maine-Anjou', 'Wagyu', 'Piedmontese', 'Red Angus',
  'Black Baldy', 'Chi-Angus',
]

interface BreedSelectorProps {
  value: BreedEntry[]
  onChange: (breeds: BreedEntry[]) => void
  error?: string
}

export function BreedSelector({ value, onChange, error }: BreedSelectorProps) {
  const total = value.reduce((s, b) => s + (b.pct || 0), 0)
  const totalOk = value.length === 0 || total === 100

  const add = () => onChange([...value, { breed: '', pct: value.length === 0 ? 100 : 0 }])

  const update = (i: number, field: keyof BreedEntry, v: string | number) => {
    const next = value.map((b, idx) => idx === i ? { ...b, [field]: v } : b)
    onChange(next)
  }

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-3">
      <datalist id="breed-list">
        {COMMON_BREEDS.map(b => <option key={b} value={b} />)}
      </datalist>

      {value.map((entry, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="flex-1">
            {i === 0 && <p className="type-field-label mb-1.5">Breed</p>}
            <Input
              list="breed-list"
              value={entry.breed}
              onChange={e => update(i, 'breed', e.target.value)}
              placeholder="e.g. Angus"
            />
          </div>
          <div style={{ width: 88 }}>
            {i === 0 && <p className="type-field-label mb-1.5">%</p>}
            <Input
              type="number"
              min={1}
              max={100}
              value={entry.pct || ''}
              onChange={e => update(i, 'pct', parseInt(e.target.value, 10) || 0)}
              placeholder="100"
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-md)] shrink-0 transition-colors duration-150"
            style={{ color: 'var(--danger-fg)', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', marginBottom: i === 0 ? 0 : 0 }}
          >
            <X size={15} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          intent="ghost"
          size="sm"
          leading={<Plus size={14} />}
          onClick={add}
        >
          ADD BREED
        </Button>

        {value.length > 0 && (
          <span
            className="type-helper font-semibold tabular-nums"
            style={{ color: totalOk ? 'var(--success-fg)' : 'var(--danger-fg)' }}
          >
            {total}% {totalOk ? '✓' : '— must total 100%'}
          </span>
        )}
      </div>

      {(error || (!totalOk && value.length > 0)) && (
        <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>
          {error ?? 'Breed percentages must total 100%'}
        </p>
      )}

      <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
        e.g. 100% Angus or 50% Angus / 50% Hereford
      </p>
    </div>
  )
}
