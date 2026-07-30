'use client'

import { useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/fetch'
import { EarTagDot } from '@/components/ui/EarTagDot'

interface Animal {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  ear_tag_color: string | null
}

export function QuickHealthSheet({ isOpen, onClose, onSuccess }: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [phase,     setPhase]     = useState<'search' | 'form'>('search')
  const [q,         setQ]         = useState('')
  const [results,   setResults]   = useState<Animal[]>([])
  const [searching, setSearching] = useState(false)
  const [animal,    setAnimal]    = useState<Animal | null>(null)

  const [eventType, setEventType] = useState('treatment')
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10))
  const [drugName,  setDrugName]  = useState('')
  const [dose,      setDose]      = useState('')
  const [unit,      setUnit]      = useState('mL')
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const reset = () => {
    setPhase('search'); setQ(''); setResults([]); setAnimal(null)
    setEventType('treatment'); setDate(new Date().toISOString().slice(0, 10))
    setDrugName(''); setDose(''); setUnit('mL'); setNotes(''); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const search = async (val: string) => {
    setQ(val)
    if (!val.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(val)}&limit=8`)
      const json = await res.json()
      setResults(json.data ?? [])
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async () => {
    if (!animal) return
    setSaving(true); setError('')
    try {
      const res  = await apiPost('/api/health', {
        animal_id:   animal.id,
        event_type:  eventType,
        event_date:  date,
        drug_name:   drugName || null,
        dose_amount: dose     || null,
        dose_unit:   unit     || null,
        notes:       notes    || null,
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error ?? 'Save failed'); return }
      reset(); onSuccess()
    } catch {
      setError('Connection error — try again')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--surface-1)',
          maxHeight: '88vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-1">
            {phase === 'form' && (
              <button onClick={() => setPhase('search')} style={{ color: 'var(--text-muted)', marginRight: 4 }}>
                <ChevronLeft size={20} />
              </button>
            )}
            <span className="type-panel-title">LOG HEALTH EVENT</span>
          </div>
          <button onClick={handleClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Phase: Search ── */}
        {phase === 'search' && (
          <div className="flex flex-col gap-3 p-5 overflow-y-auto">
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Search for an animal to log a health event
            </p>
            <input
              type="text"
              value={q}
              onChange={e => search(e.target.value)}
              placeholder="Tag # or name…"
              className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
              style={{
                backgroundColor: 'var(--surface-0)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
            {searching && (
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Searching…</p>
            )}
            {results.map(a => (
              <button
                key={a.id}
                onClick={() => { setAnimal(a); setPhase('form') }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] text-left w-full transition-colors"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <EarTagDot color={a.ear_tag_color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>
                    #{a.tag_number}
                  </p>
                  {a.name && (
                    <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{a.name}</p>
                  )}
                </div>
                {a.sex && (
                  <span className="type-data-sm shrink-0" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {a.sex}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Phase: Form ── */}
        {phase === 'form' && animal && (
          <>
            {/* Selected animal banner */}
            <div
              className="flex items-center gap-2 px-5 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}
            >
              <EarTagDot color={animal.ear_tag_color} size="sm" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>
                #{animal.tag_number}
              </span>
              {animal.name && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{animal.name}</span>
              )}
              {animal.sex && (
                <span className="type-data-sm" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', marginLeft: 'auto' }}>
                  {animal.sex}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
              {/* Type */}
              <div>
                <p className="type-section-label mb-2">TYPE</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['treatment', 'TREATMENT'], ['vaccine', 'VACCINE'], ['observation', 'OBSERVE']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setEventType(val)}
                      className="py-2.5 rounded-[var(--radius-md)] type-data-sm font-semibold"
                      style={{
                        backgroundColor: eventType === val ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${eventType === val ? 'var(--accent-border)' : 'var(--border)'}`,
                        color: eventType === val ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <p className="type-section-label mb-2">DATE</p>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-md)] type-body"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Drug */}
              <div>
                <p className="type-section-label mb-2">DRUG / TREATMENT</p>
                <input
                  type="text"
                  value={drugName}
                  onChange={e => setDrugName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full px-3 py-2.5 rounded-[var(--radius-md)] type-body"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Dose + unit */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="type-section-label mb-2">DOSE</p>
                  <input
                    type="text"
                    value={dose}
                    onChange={e => setDose(e.target.value)}
                    placeholder="Amount"
                    className="w-full px-3 py-2.5 rounded-[var(--radius-md)] type-body"
                    style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <p className="type-section-label mb-2">UNIT</p>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="px-3 rounded-[var(--radius-md)] type-body"
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      height: '2.625rem',
                    }}
                  >
                    {['mL', 'cc', 'mg', 'g', 'tabs', 'oz'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="type-section-label mb-2">NOTES</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observations…"
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] type-body resize-none"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              {error && (
                <p
                  className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
                  style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
                >
                  {error}
                </p>
              )}
            </div>

            <div className="p-5 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-[var(--radius-lg)] type-body font-bold tracking-wide disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}
              >
                {saving ? 'SAVING…' : 'SAVE HEALTH EVENT'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
