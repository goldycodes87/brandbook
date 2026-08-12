'use client'

import { useState, useMemo } from 'react'
import { Field, Input } from '@/components/ui/Field'
import { ANIMAL_CLASSES, type AnimalClass } from '@/lib/expense-split'

export interface PickerAnimal {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  owner_id?: string | null
}

export interface PickerOwner {
  id: string
  name: string
  is_self?: boolean | null
}

interface Props {
  animals: PickerAnimal[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /**
   * When provided, animals are grouped by owner with a select-all per group
   * and ranch-owned animals (owner_id null) shown under "Your cattle".
   */
  owners?: PickerOwner[]
  groupByOwner?: boolean
}

/**
 * Multi-select animal picker for animal-specific expenses.
 *
 * The class chips and the search box narrow the VIEW only — they never drop a
 * selection. Switching from STEER back to ALL keeps everything already ticked,
 * so you can build a set across several classes (or pick from all animals at
 * once) and still use the filter to find them quickly.
 */
export function AnimalMultiSelect({ animals, selectedIds, onChange, owners, groupByOwner }: Props) {
  const [search, setSearch] = useState('')
  const [cls,    setCls]    = useState<AnimalClass | 'all'>('all')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return animals.filter(a => {
      if (cls !== 'all' && (a.sex ?? '') !== cls) return false
      if (!q) return true
      return a.tag_number.toLowerCase().includes(q) || (a.name ?? '').toLowerCase().includes(q)
    })
  }, [animals, search, cls])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of animals) {
      const k = a.sex ?? 'unknown'
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }, [animals])

  // Owner groups are built from the VISIBLE set, so a class filter narrows the
  // per-owner select-all too (e.g. STEER + "select all Andy's" = Andy's steers).
  const ownerGroups = useMemo(() => {
    if (!groupByOwner) return []
    const byOwner = new Map<string, { key: string; name: string; animals: PickerAnimal[] }>()
    for (const a of visible) {
      const key  = a.owner_id ?? '__self__'
      const name = a.owner_id
        ? (owners?.find(o => o.id === a.owner_id)?.name ?? 'Owner')
        : 'Your cattle'
      if (!byOwner.has(key)) byOwner.set(key, { key, name, animals: [] })
      byOwner.get(key)!.animals.push(a)
    }
    return [...byOwner.values()].sort((x, y) =>
      x.key === '__self__' ? -1 : y.key === '__self__' ? 1 : x.name.localeCompare(y.name))
  }, [visible, owners, groupByOwner])

  const visibleIds = visible.map(a => a.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id))
  }

  function toggleAllVisible() {
    onChange(
      allVisibleSelected
        ? selectedIds.filter(id => !visibleIds.includes(id))
        : Array.from(new Set([...selectedIds, ...visibleIds]))
    )
  }

  return (
    <Field label={`Animals (${selectedIds.length} selected)`} required>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(['all', ...ANIMAL_CLASSES] as const).map(c => {
          const active = cls === c
          const n = c === 'all' ? animals.length : (counts[c] ?? 0)
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCls(c)}
              className="px-2.5 py-1 rounded-full text-xs font-bold uppercase"
              style={{
                border:     `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-soft)' : 'var(--surface-1)',
                color:      active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {c === 'all' ? 'ALL' : c} {n}
            </button>
          )
        })}
      </div>

      <Input
        placeholder="Search by tag or name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-2"
      />

      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={toggleAllVisible}
          className="text-xs font-bold"
          style={{ color: 'var(--accent)' }}
        >
          {allVisibleSelected ? `CLEAR THESE ${visibleIds.length}` : `SELECT ALL ${visibleIds.length}`}
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            CLEAR ALL
          </button>
        )}
      </div>

      {groupByOwner && (
        <div className="flex flex-col gap-1.5 mb-2">
          {ownerGroups.map(g => {
            const ids = g.animals.map(a => a.id)
            const allSel = ids.length > 0 && ids.every(id => selectedIds.includes(id))
            const selCount = ids.filter(id => selectedIds.includes(id)).length
            return (
              <div key={g.key} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-xs font-bold uppercase" style={{ color: 'var(--text)' }}>
                  {g.name} <span style={{ color: 'var(--text-muted)' }}>({selCount}/{ids.length})</span>
                </span>
                <button
                  type="button"
                  className="text-xs font-bold"
                  style={{ color: 'var(--accent)' }}
                  onClick={() =>
                    onChange(allSel
                      ? selectedIds.filter(id => !ids.includes(id))
                      : Array.from(new Set([...selectedIds, ...ids])))
                  }
                >
                  {allSel ? 'CLEAR' : 'SELECT ALL'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {visible.map(a => {
          const checked = selectedIds.includes(a.id)
          return (
            <label
              key={a.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
              style={{
                border:     `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                background: checked ? 'var(--accent-soft)' : 'var(--surface-1)',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => toggle(a.id, e.target.checked)}
              />
              <span
                className="font-mono font-semibold"
                style={{ color: checked ? 'var(--accent)' : 'var(--text)' }}
              >
                #{a.tag_number}
              </span>
              {a.sex && (
                <span className="type-helper uppercase" style={{ color: 'var(--text-muted)' }}>
                  {a.sex}
                </span>
              )}
              {a.name && (
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  {a.name}
                </span>
              )}
            </label>
          )
        })}
        {visible.length === 0 && (
          <p className="type-helper px-2" style={{ color: 'var(--text-muted)' }}>
            No animals match
          </p>
        )}
      </div>
    </Field>
  )
}
