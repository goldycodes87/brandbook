'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EarTagDot } from '@/components/ui/EarTagDot'

interface LeaseAnimal {
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
  animal: LeaseAnimal | null
  onSuccess: () => void
}

export function RemoveAnimalsSheet({ isOpen, onClose, leaseId, animal, onSuccess }: Props) {
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (isOpen) {
      setEndDate(new Date().toISOString().slice(0, 10))
      setError('')
    }
  }, [isOpen])

  const handleRemove = async () => {
    if (!animal) return
    if (!endDate) { setError('Removal date is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(
        `/api/leases/${leaseId}/animals?animal_id=${animal.id}&end_date=${endDate}`,
        { method: 'DELETE' }
      )
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Remove failed'); return }
      onSuccess(); onClose()
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (!isOpen || !animal) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-xl md:rounded-xl md:max-w-sm flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="type-panel-title" style={{ color: 'var(--text)' }}>REMOVE ANIMAL</h2>
          <button type="button" onClick={onClose}>
            <X size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0 }}>
          {/* Animal preview */}
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <EarTagDot color={animal.ear_tag_color} size="md" />
            <div>
              <p className="font-mono font-bold text-sm" style={{ color: 'var(--text)' }}>#{animal.tag_number}</p>
              {animal.name && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{animal.name}</p>}
            </div>
            {animal.sex && (
              <span
                className="ml-auto inline-block px-1.5 rounded text-xs font-semibold uppercase"
                style={{ background: 'var(--surface-1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {animal.sex}
              </span>
            )}
          </div>

          <Field label="Removal date" helper="Defaults to today — backdate if animal left earlier">
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          <Button type="button" intent="danger" size="sm" loading={saving} onClick={handleRemove} className="ml-auto">
            REMOVE FROM LEASE
          </Button>
        </div>
      </div>
    </div>
  )
}
