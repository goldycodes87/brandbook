'use client'

import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { BluetoothScale } from '@/components/hardware/BluetoothScale'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost } from '@/lib/fetch'

interface WeightFormProps {
  animalId: string
  onSuccess?: () => void
  onCancel?: () => void
}

interface CsvRow { weight_lbs: number; weighed_at: string }

function parseGallagherCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n')
  const rows: CsvRow[] = []
  // Try to find weight and date columns by header name
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const wIdx   = header.findIndex(h => h.includes('weight') || h === 'liveweight')
  const dIdx   = header.findIndex(h => h.includes('date') || h.includes('time'))

  if (wIdx === -1) return rows

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
    const raw  = parseFloat(cols[wIdx])
    if (isNaN(raw) || raw <= 0) continue
    // Gallagher exports lbs or kg — assume lbs if > 50, else convert kg→lbs
    const lbs  = raw > 50 ? raw : parseFloat((raw * 2.20462).toFixed(1))
    const dateStr = dIdx !== -1 ? cols[dIdx] : new Date().toISOString()
    const parsed  = new Date(dateStr)
    rows.push({ weight_lbs: lbs, weighed_at: isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString() })
  }
  return rows
}

export function WeightForm({ animalId, onSuccess, onCancel }: WeightFormProps) {
  const [weight, setWeight]       = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [csvRows, setCsvRows]     = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleBluetoothWeight = (lbs: number) => {
    setWeight(String(lbs))
  }

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseGallagherCsv(text)
      setCsvRows(rows)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const importCsv = async () => {
    if (!csvRows.length) return
    setImporting(true)
    setError('')
    try {
      const res = await apiPost(`/api/animals/${animalId}/weights/bulk`, csvRows)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Import failed'); return }
      setCsvRows([])
      onSuccess?.()
    } catch {
      setError('Connection error')
    } finally {
      setImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const lbs = parseFloat(weight)
    if (isNaN(lbs) || lbs <= 0) { setError('Enter a valid weight'); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiPost(`/api/animals/${animalId}/weights`, { weight_lbs: lbs, weighed_at: date, notes: notes || null, source: 'manual' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      onSuccess?.()
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bluetooth */}
      <div>
        <p className="type-field-label mb-2">Bluetooth scale</p>
        <BluetoothScale onWeight={handleBluetoothWeight} />
      </div>

      {/* CSV import */}
      <div>
        <p className="type-field-label mb-2">Import from Gallagher CSV</p>
        <label
          className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-[var(--radius-md)] transition-colors type-button"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <Upload size={14} />
          Choose CSV file
          <input ref={fileRef} type="file" accept=".csv,.txt" className="sr-only" onChange={handleCsvSelect} />
        </label>

        {csvRows.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div
              className="rounded-[var(--radius-md)] overflow-hidden"
              style={{ border: '1px solid var(--border)', maxHeight: 160, overflowY: 'auto' }}
            >
              <table className="w-full text-left">
                <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                  <tr>
                    <th className="type-field-label px-3 py-2">Weight</th>
                    <th className="type-field-label px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 50).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="type-data-sm px-3 py-1.5">{r.weight_lbs} lb</td>
                      <td className="type-data-sm px-3 py-1.5">{new Date(r.weighed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" intent="primary" size="sm" loading={importing} onClick={importCsv}>
              IMPORT {csvRows.length} WEIGHT{csvRows.length !== 1 ? 'S' : ''}
            </Button>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <p className="type-field-label mb-3" style={{ color: 'var(--text-muted)' }}>Or enter manually</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (lbs)" required>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="0.0"
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional…" />
          </Field>

          {error && (
            <ContextBanner tone="danger">{error}</ContextBanner>
          )}

          <div className="flex gap-2">
            <Button type="submit" intent="primary" loading={saving}>SAVE WEIGHT</Button>
            {onCancel && <Button type="button" intent="ghost" onClick={onCancel}>CANCEL</Button>}
          </div>
        </form>
      </div>
    </div>
  )
}
