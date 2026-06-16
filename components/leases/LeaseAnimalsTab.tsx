'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { AssignAnimalsSheet } from './AssignAnimalsSheet'
import { RemoveAnimalsSheet } from './RemoveAnimalsSheet'
import Badge from '@/components/ui/Badge'

interface LeaseAnimal {
  id: string
  tag_number: string
  name: string | null
  ear_tag_color: string | null
  sex: string | null
  owner_name: string | null
  start_date: string | null
  end_date: string | null
  assignment_id: string | null
}

const AUM_FACTOR: Record<string, number> = {
  bull: 1.5, cow: 1.0, heifer: 0.75, steer: 0.75, calf: 0.5,
}

function aumFor(sex: string | null): number {
  return sex ? (AUM_FACTOR[sex.toLowerCase()] ?? 1.0) : 1.0
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  leaseId: string
  leaseName: string
  ranchName?: string
}

export function LeaseAnimalsTab({ leaseId, leaseName, ranchName = '' }: Props) {
  const [animals, setAnimals]           = useState<LeaseAnimal[]>([])
  const [loading, setLoading]           = useState(true)
  const [assignOpen, setAssignOpen]     = useState(false)
  const [removeTarget, setRemoveTarget] = useState<LeaseAnimal | null>(null)
  const [showHistory, setShowHistory]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = showHistory
        ? `/api/leases/${leaseId}/animals?include_past=1`
        : `/api/leases/${leaseId}/animals`
      const res  = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      setAnimals(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [leaseId, showHistory])

  useEffect(() => { load() }, [load])

  const active = animals.filter(a => !a.end_date)
  const past   = animals.filter(a =>  a.end_date)

  const totalAum = active.reduce((s, a) => s + aumFor(a.sex), 0)

  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 mt-4">

      {/* Summary row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
          {active.length} {active.length === 1 ? 'animal' : 'animals'} assigned
          {active.length > 0 && ` · ${totalAum.toFixed(1)} AUM`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 type-helper px-2 py-1 rounded"
            style={{
              color: showHistory ? 'var(--accent)' : 'var(--text-muted)',
              background: showHistory ? 'var(--accent-soft)' : 'transparent',
              border: '1px solid var(--border)',
            }}
            onClick={() => setShowHistory(h => !h)}
          >
            <Clock size={12} />
            HISTORY
          </button>
          <Button intent="primary" size="sm" onClick={() => setAssignOpen(true)}>
            <Plus size={14} className="mr-1" />
            ASSIGN ANIMALS
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {active.length === 0 && !showHistory && (
        <div
          className="rounded-lg px-5 py-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No animals assigned yet.</p>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Assign animals to start tracking grazing.</p>
          <Button intent="primary" size="sm" onClick={() => setAssignOpen(true)}>
            <Plus size={14} className="mr-1" />
            ASSIGN ANIMALS
          </Button>
        </div>
      )}

      {/* Active animals */}
      {active.map(a => {
        const aum = aumFor(a.sex)
        return (
          <div
            key={a.id}
            className="rounded-lg px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <EarTagDot color={a.ear_tag_color} size="md" />
              <div className="min-w-0">
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
                  {(a.owner_name || ranchName) && (
                    <span
                      className="inline-block px-1.5 rounded text-xs uppercase"
                      style={{ background: 'var(--surface-1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      {a.owner_name || ranchName}
                    </span>
                  )}
                </div>
                {a.name && <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{a.name}</p>}
                {a.start_date && (
                  <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Since {fmtDate(a.start_date)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text)' }}>{aum.toFixed(1)}</p>
                <p className="type-helper leading-tight" style={{ color: 'var(--text-muted)' }}>AUM</p>
              </div>
              <Button intent="danger" size="sm" onClick={() => setRemoveTarget(a)}>
                REMOVE
              </Button>
            </div>
          </div>
        )
      })}

      {/* Past assignments */}
      {showHistory && past.length > 0 && (
        <>
          <p className="type-section-label mt-2" style={{ color: 'var(--text-muted)' }}>PAST ASSIGNMENTS</p>
          {past.map(a => (
            <div
              key={`${a.id}-${a.end_date}`}
              className="rounded-lg px-4 py-3 flex items-center gap-3 opacity-60"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
            >
              <EarTagDot color={a.ear_tag_color} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm" style={{ color: 'var(--text)' }}>{a.tag_number}</span>
                  {a.sex && (
                    <span
                      className="inline-block px-1.5 rounded text-xs uppercase"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      {a.sex}
                    </span>
                  )}
                  <Badge variant="neutral">REMOVED</Badge>
                </div>
                {a.name && <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{a.name}</p>}
                <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  {fmtDate(a.start_date)} → {fmtDate(a.end_date)}
                </p>
              </div>
            </div>
          ))}
        </>
      )}

      {showHistory && past.length === 0 && active.length === 0 && (
        <p className="type-helper text-center py-4" style={{ color: 'var(--text-muted)' }}>No assignment history yet.</p>
      )}

      <AssignAnimalsSheet
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        leaseId={leaseId}
        leaseName={leaseName}
        alreadyAssignedIds={active.map(a => a.id)}
        onSuccess={() => { setAssignOpen(false); load() }}
      />

      <RemoveAnimalsSheet
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        leaseId={leaseId}
        animal={removeTarget}
        onSuccess={() => { setRemoveTarget(null); load() }}
      />
    </div>
  )
}
