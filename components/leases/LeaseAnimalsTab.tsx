'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AssignAnimalsSheet } from './AssignAnimalsSheet'

interface LeaseAnimal {
  id: string
  tag_number: string
  name: string | null
  ear_tag_color: string | null
  sex: string | null
  owner_name: string | null
  start_date: string | null
  assignment_id: string | null
}

const AUM_FACTOR: Record<string, number> = {
  bull: 1.5, cow: 1.0, heifer: 0.75, steer: 0.75, calf: 0.5,
}

function aumFor(sex: string | null): number {
  return sex ? (AUM_FACTOR[sex.toLowerCase()] ?? 1.0) : 1.0
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
  const [removing, setRemoving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/leases/${leaseId}/animals`, { cache: 'no-store' })
      const json = await res.json()
      setAnimals(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [leaseId])

  useEffect(() => { load() }, [load])

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await fetch(`/api/leases/${leaseId}/animals?animal_id=${removeTarget.id}`, { method: 'DELETE' })
      setRemoveTarget(null)
      load()
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    )
  }

  const totalAum = animals.reduce((s, a) => s + aumFor(a.sex), 0)

  return (
    <div className="flex flex-col gap-4 mt-4">

      {/* Summary row */}
      <div className="flex items-center justify-between">
        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
          {animals.length} {animals.length === 1 ? 'animal' : 'animals'} assigned
          {animals.length > 0 && ` · ${totalAum.toFixed(1)} AUM`}
        </p>
        <Button intent="primary" size="sm" onClick={() => setAssignOpen(true)}>
          <Plus size={14} className="mr-1" />
          ASSIGN ANIMALS
        </Button>
      </div>

      {/* Empty state */}
      {animals.length === 0 && (
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

      {/* Animal cards */}
      {animals.map(a => {
        const aum = aumFor(a.sex)
        return (
          <div
            key={a.id}
            className="rounded-lg px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {/* Left */}
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
              </div>
            </div>

            {/* Right */}
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

      <AssignAnimalsSheet
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        leaseId={leaseId}
        leaseName={leaseName}
        alreadyAssignedIds={animals.map(a => a.id)}
        onSuccess={() => { setAssignOpen(false); load() }}
      />

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove animal?"
        message={
          removeTarget
            ? `Remove ${removeTarget.tag_number}${removeTarget.name ? ` (${removeTarget.name})` : ''} from this lease? The assignment will be ended today.`
            : ''
        }
        confirmLabel="REMOVE"
        loading={removing}
      />
    </div>
  )
}
