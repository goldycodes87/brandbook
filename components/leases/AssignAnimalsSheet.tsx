'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EarTagDot } from '@/components/ui/EarTagDot'

interface AllAnimal {
  id: string
  tag_number: string
  name: string | null
  ear_tag_color: string | null
  sex: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  leaseId: string
  leaseName: string
  alreadyAssignedIds: string[]
  onSuccess: () => void
}

export function AssignAnimalsSheet({ isOpen, onClose, leaseId, leaseName, alreadyAssignedIds, onSuccess }: Props) {
  const [allAnimals, setAllAnimals] = useState<AllAnimal[]>([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!isOpen) { setSearch(''); setSelected(new Set()); setError(''); return }
    setLoading(true)
    fetch('/api/animals?status=active&limit=200')
      .then(r => r.json())
      .then(json => setAllAnimals(json.data ?? []))
      .finally(() => setLoading(false))
  }, [isOpen])

  const assignedSet = useMemo(() => new Set(alreadyAssignedIds), [alreadyAssignedIds])

  const available = useMemo(() => {
    const unassigned = allAnimals.filter(a => !assignedSet.has(a.id))
    if (!search.trim()) return unassigned
    const q = search.toLowerCase()
    return unassigned.filter(a =>
      a.tag_number.toLowerCase().includes(q) ||
      (a.name ?? '').toLowerCase().includes(q)
    )
  }, [allAnimals, assignedSet, search])

  const toggle   = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelected(new Set(available.map(a => a.id)))
  const clearAll  = () => setSelected(new Set())

  const handleSubmit = async () => {
    if (!selected.size) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/leases/${leaseId}/animals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animal_ids: [...selected] }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed to assign'); return }
      onSuccess()
    } catch { setError('Connection error') }
    finally { setSubmitting(false) }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-xl md:rounded-xl md:max-w-lg flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar — mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="type-panel-title" style={{ color: 'var(--text)' }}>ASSIGN ANIMALS</h2>
            {leaseName && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{leaseName}</p>}
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Search + select-all controls */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0 flex flex-col gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by tag or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          {available.length > 0 && (
            <div className="flex items-center gap-3">
              <button type="button" className="type-helper" style={{ color: 'var(--accent)' }} onClick={selectAll}>
                Select all ({available.length})
              </button>
              {selected.size > 0 && (
                <>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <button type="button" className="type-helper" style={{ color: 'var(--text-muted)' }} onClick={clearAll}>
                    Clear
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Animal list */}
        <div className="flex-1" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0 }}>
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
              ))}
            </div>
          ) : available.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                {search
                  ? 'No animals match your search.'
                  : 'All active animals are already assigned to this lease.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {available.map((a, i) => {
                const checked = selected.has(a.id)
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{
                      borderBottom: i < available.length - 1 ? '1px solid var(--border)' : undefined,
                      background: checked ? 'var(--surface-2)' : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a.id)}
                      className="flex-shrink-0 w-4 h-4"
                    />
                    <EarTagDot color={a.ear_tag_color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm" style={{ color: 'var(--text)' }}>{a.tag_number}</span>
                        {a.sex && (
                          <span
                            className="inline-block px-1.5 rounded text-xs font-semibold uppercase"
                            style={{ background: 'var(--surface-1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                          >
                            {a.sex}
                          </span>
                        )}
                      </div>
                      {a.name && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</p>}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 py-2 flex-shrink-0">
            <p
              className="type-helper px-3 py-2 rounded"
              style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
            >
              {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          <Button
            type="button"
            intent="primary"
            size="sm"
            className="ml-auto"
            disabled={selected.size === 0}
            loading={submitting}
            onClick={handleSubmit}
          >
            ASSIGN{selected.size > 0 ? ` ${selected.size}` : ''} ANIMALS
          </Button>
        </div>
      </div>
    </div>
  )
}
