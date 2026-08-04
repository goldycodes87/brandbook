'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field, Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SireLib {
  id: string
  bull_name: string
  breed: string | null
  epd_ced: number | null
  epd_bw: number | null
  epd_ww: number | null
  epd_yw: number | null
  epd_marbling: number | null
  naab_code: string | null
}

interface InventoryItem {
  id: string
  sire_name: string
  straw_count: number | null
  price_per_straw: number | null
  tank_name: string | null
  canister: string | null
  cane: string | null
  straw_size: string | null
  is_sexed: boolean | null
  purchase_date: string | null
  notes: string | null
  sire_library_id: string | null
  sire_library: SireLib | null
}

interface SireLookup {
  id: string
  bull_name: string
  breed: string | null
  naab_code: string | null
}

// Per-row state for the multi-bull entry list
interface RowData {
  _key: string
  selectedSire: SireLookup | null
  prefillSearch: string   // populated from scan results
  qty: string
  pricePerStraw: string
  strawSize: '0.5cc' | '0.25cc'
  isSexed: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function strawCountColor(n: number | null): string {
  if (!n || n === 0) return 'var(--danger-fg)'
  if (n <= 2) return '#c87a00'
  return 'var(--success-fg)'
}

function emptyRow(): RowData {
  return {
    _key: Math.random().toString(36).slice(2),
    selectedSire: null,
    prefillSearch: '',
    qty: '',
    pricePerStraw: '',
    strawSize: '0.5cc',
    isSexed: false,
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

// ── StrawRowEditor ────────────────────────────────────────────────────────────
// Owns its own sire search + inline create state; reports settled values upward.

function StrawRowEditor({ row, index, canRemove, onChange, onRemove }: {
  row: RowData
  index: number
  canRemove: boolean
  onChange: (r: RowData) => void
  onRemove: () => void
}) {
  const [search,      setSearch]      = useState(row.prefillSearch)
  const [results,     setResults]     = useState<SireLookup[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [createName,  setCreateName]  = useState('')
  const [createNaab,  setCreateNaab]  = useState('')
  const [isCreating,  setIsCreating]  = useState(false)
  const [createError, setCreateError] = useState('')

  // Sync prefill when parent updates it (scan mode → manual mode switch)
  useEffect(() => {
    if (row.prefillSearch) setSearch(row.prefillSearch)
  }, [row.prefillSearch])

  // Debounced sire search
  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setIsSearching(true)
      try {
        const r = await apiGet(`/api/genetics/sires?search=${encodeURIComponent(search)}&limit=6`)
        const d = await r.json()
        setResults((d.data ?? []).map((s: SireLookup) => ({
          id: s.id, bull_name: s.bull_name, breed: s.breed, naab_code: s.naab_code,
        })))
      } finally { setIsSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const selectSire = (s: SireLookup) => {
    onChange({ ...row, selectedSire: s, prefillSearch: '' })
    setSearch(''); setResults([])
  }

  const openCreate = () => {
    setCreateName(search.trim())
    setCreateNaab('')
    setCreateError('')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!createName.trim()) { setCreateError('Bull name required'); return }
    setIsCreating(true); setCreateError('')
    try {
      const r = await apiPost('/api/genetics/sires', {
        bull_name: createName.trim(),
        naab_code: createNaab.trim() || null,
      })
      const d = await r.json()
      if (!r.ok) { setCreateError(d.error ?? 'Create failed'); return }
      const newSire: SireLookup = {
        id: d.data.id, bull_name: d.data.bull_name,
        breed: d.data.breed, naab_code: d.data.naab_code,
      }
      onChange({ ...row, selectedSire: newSire, prefillSearch: '' })
      setShowCreate(false); setSearch(''); setResults([])
    } catch { setCreateError('Connection error') }
    finally { setIsCreating(false) }
  }

  return (
    <div className="rounded-xl p-3 flex flex-col gap-3"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>

      {/* Row label + remove */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          BULL {index + 1}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="text-base font-bold leading-none px-1"
            style={{ color: 'var(--text-muted)' }} aria-label="Remove row">×</button>
        )}
      </div>

      {/* Bull selection */}
      {row.selectedSire ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
          style={{ border: '2px solid var(--accent)', background: 'var(--accent-soft)' }}>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{row.selectedSire.bull_name}</p>
            {row.selectedSire.naab_code && (
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{row.selectedSire.naab_code}</p>
            )}
          </div>
          <button type="button" className="type-helper" style={{ color: 'var(--text-muted)' }}
            onClick={() => onChange({ ...row, selectedSire: null })}>change</button>
        </div>
      ) : showCreate ? (
        <div className="flex flex-col gap-2 p-3 rounded-lg"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>CREATE NEW BULL</p>
          <input
            type="text" value={createName} onChange={e => setCreateName(e.target.value)}
            placeholder="Bull name (required)"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)' }}
          />
          <input
            type="text" value={createNaab} onChange={e => setCreateNaab(e.target.value)}
            placeholder="NAAB code (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)' }}
          />
          {createError && (
            <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{createError}</p>
          )}
          <div className="flex gap-2">
            <Button type="button" intent="ghost" size="sm" onClick={() => setShowCreate(false)}>CANCEL</Button>
            <Button type="button" intent="primary" size="sm" loading={isCreating} onClick={handleCreate}>CREATE</Button>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by bull name or NAAB…"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
          {isSearching && (
            <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>Searching…</p>
          )}
          {results.length > 0 && (
            <div className="rounded-lg overflow-hidden mt-1" style={{ border: '1px solid var(--border)' }}>
              {results.map(s => (
                <button key={s.id} type="button" onClick={() => selectSire(s)}
                  className="w-full text-left px-3 py-2.5 text-sm"
                  style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)' }}>
                  <span className="font-semibold">{s.bull_name}</span>
                  {s.naab_code && (
                    <span className="ml-2 type-helper" style={{ color: 'var(--text-muted)' }}>{s.naab_code}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {search.trim().length >= 2 && !isSearching && (
            <button type="button" onClick={openCreate}
              className="mt-1.5 text-xs font-semibold"
              style={{ color: 'var(--accent)' }}>
              + Create new bull &ldquo;{search.trim()}&rdquo;
            </button>
          )}
        </div>
      )}

      {/* Qty + price */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Qty *</p>
          <input
            type="number" min="1" step="1" value={row.qty}
            onChange={e => onChange({ ...row, qty: e.target.value })}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <p className="text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>$/straw</p>
          <input
            type="number" min="0" step="0.01" value={row.pricePerStraw}
            onChange={e => onChange({ ...row, pricePerStraw: e.target.value })}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
        </div>
      </div>

      {/* Size + sexed */}
      <div className="flex items-center gap-3">
        <div className="flex rounded overflow-hidden flex-1" style={{ border: '1px solid var(--border)' }}>
          {([['0.5cc', '1/2cc'], ['0.25cc', '1/4cc']] as const).map(([val, label]) => (
            <button key={val} type="button" onClick={() => onChange({ ...row, strawSize: val })}
              className="flex-1 px-2 py-1.5 text-xs font-semibold"
              style={{
                background:  row.strawSize === val ? 'var(--accent)' : 'var(--surface-2)',
                color:       row.strawSize === val ? 'white' : 'var(--text-muted)',
                borderRight: val === '0.5cc' ? '1px solid var(--border)' : undefined,
              }}>{label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input type="checkbox" checked={row.isSexed}
            onChange={e => onChange({ ...row, isSexed: e.target.checked })} />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Sexed</span>
        </label>
      </div>
    </div>
  )
}

// ── AddStrawsSheet ────────────────────────────────────────────────────────────
// Multi-bull straw purchase: manual entry or invoice scan → review → batch save.

interface ParsedSemenRow {
  sire_name: string
  naab_code: string | null
  quantity: number
  price_per_straw: number | null
  straw_size: string | null
  is_sexed: boolean
}

function AddStrawsSheet({ isOpen, onClose, onSuccess }: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [mode,         setMode]         = useState<'manual' | 'scan'>('manual')
  const [rows,         setRows]         = useState<RowData[]>([emptyRow()])
  const [tankName,     setTankName]     = useState('Legacy Tank')
  const [canister,     setCanister]     = useState('')
  const [cane,         setCane]         = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [scanning,     setScanning]     = useState(false)
  const [scanError,    setScanError]    = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMode('manual')
      setRows([emptyRow()])
      setTankName('Legacy Tank'); setCanister(''); setCane(''); setPurchaseDate('')
      setSaving(false); setError(''); setScanning(false); setScanError('')
    }
  }, [isOpen])

  const updateRow = (idx: number, r: RowData) =>
    setRows(prev => prev.map((row, i) => i === idx ? r : row))
  const removeRow = (idx: number) =>
    setRows(prev => prev.filter((_, i) => i !== idx))

  const handleScan = async (file: File) => {
    setScanning(true); setScanError('')
    try {
      const file_base64 = await fileToBase64(file)
      const media_type  = file.type || 'application/octet-stream'
      const r           = await apiPost('/api/ai/parse-semen', { file_base64, media_type })
      const d           = await r.json()
      if (!r.ok) { setScanError(d.error ?? 'Parse failed'); return }

      const parsed: ParsedSemenRow[] = d.rows ?? []
      if (parsed.length === 0) { setScanError('No straw line items found in this file.'); return }

      // Match each parsed row to sire_library
      const newRows: RowData[] = await Promise.all(parsed.map(async p => {
        let selectedSire: SireLookup | null = null
        const term = p.naab_code || p.sire_name
        try {
          const sr = await apiGet(`/api/genetics/sires?search=${encodeURIComponent(term)}&limit=3`)
          const sd = await sr.json()
          const hits: SireLookup[] = sd.data ?? []
          if (hits.length > 0) {
            const exact = p.naab_code
              ? hits.find(h => h.naab_code?.toLowerCase() === p.naab_code?.toLowerCase())
              : hits.find(h => h.bull_name.toLowerCase() === p.sire_name.toLowerCase())
            selectedSire = exact ?? hits[0]
          }
        } catch { /* leave null — user will resolve */ }

        return {
          _key:          Math.random().toString(36).slice(2),
          selectedSire,
          prefillSearch: selectedSire ? '' : p.sire_name,
          qty:           p.quantity > 0 ? String(p.quantity) : '',
          pricePerStraw: p.price_per_straw != null ? String(p.price_per_straw) : '',
          strawSize:     (p.straw_size === '0.25cc' ? '0.25cc' : '0.5cc') as '0.5cc' | '0.25cc',
          isSexed:       Boolean(p.is_sexed),
        }
      }))

      setRows(newRows)
      setMode('manual')  // Switch to review
    } catch (err) {
      setScanError((err as Error).message || 'Scan failed')
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setError('')
    const invalid = rows.find(r => !r.selectedSire || !r.qty || Number(r.qty) <= 0)
    if (invalid) { setError('Each row needs a bull and a quantity greater than 0.'); return }

    setSaving(true)
    try {
      const payload = rows.map(r => ({
        sire_library_id: r.selectedSire!.id,
        straw_count:     Number(r.qty),
        price_per_straw: r.pricePerStraw ? Number(r.pricePerStraw) : null,
        straw_size:      r.strawSize,
        is_sexed:        r.isSexed,
        tank_name:       tankName || 'Legacy Tank',
        canister:        canister || null,
        cane:            cane    || null,
        purchase_date:   purchaseDate || null,
      }))
      const res = await apiPost('/api/genetics/tank', payload)
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-t-2xl md:rounded-2xl flex flex-col w-full md:max-w-lg"
        style={{ background: 'var(--surface-0)', maxHeight: '92dvh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>ADD STRAWS</h2>
          <button type="button" onClick={onClose} className="text-xl font-bold"
            style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}>
            {(['manual', 'scan'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className="flex-1 py-2 text-xs font-bold tracking-widest"
                style={{
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color:      mode === m ? 'white' : 'var(--text-muted)',
                }}>
                {m === 'manual' ? 'MANUAL' : 'SCAN INVOICE'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4" style={{ minHeight: 0 }}>

          {/* ── Scan mode ── */}
          {mode === 'scan' && (
            <div className="flex flex-col gap-3">
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                Upload a semen invoice (JPG, PNG, or PDF). Parsed rows will prefill the entry list for your review.
              </p>
              <input
                ref={fileRef} type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }}
              />
              <Button intent="secondary" size="sm" loading={scanning}
                onClick={() => fileRef.current?.click()}>
                {scanning ? 'SCANNING…' : '📎 CHOOSE FILE'}
              </Button>
              {scanError && (
                <p className="type-helper px-3 py-2 rounded"
                  style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                  {scanError}
                </p>
              )}
            </div>
          )}

          {/* ── Manual mode — editable row list ── */}
          {mode === 'manual' && (
            <>
              <div className="flex flex-col gap-3">
                {rows.map((row, idx) => (
                  <StrawRowEditor
                    key={row._key} row={row} index={idx}
                    canRemove={rows.length > 1}
                    onChange={r => updateRow(idx, r)}
                    onRemove={() => removeRow(idx)}
                  />
                ))}
              </div>

              <button type="button"
                onClick={() => setRows(prev => [...prev, emptyRow()])}
                className="text-sm font-semibold py-2.5 rounded-xl w-full"
                style={{ color: 'var(--accent)', border: '1.5px dashed var(--accent)', background: 'transparent' }}>
                + ADD ANOTHER BULL
              </button>

              {/* Shared batch fields */}
              <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-bold pt-2"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  TANK DETAILS — APPLIES TO ALL ROWS
                </p>
                <Field label="Tank Name">
                  <Input value={tankName} onChange={e => setTankName(e.target.value)} placeholder="Legacy Tank" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Canister">
                    <Input value={canister} onChange={e => setCanister(e.target.value)} placeholder="e.g. 3" />
                  </Field>
                  <Field label="Cane">
                    <Input value={cane} onChange={e => setCane(e.target.value)} placeholder="e.g. 2" />
                  </Field>
                </div>
                <Field label="Purchase Date">
                  <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {error && (
            <p className="type-helper px-3 py-2 rounded"
              style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          {mode === 'manual' && (
            <Button type="button" intent="primary" size="sm" className="flex-1"
              loading={saving} onClick={handleSave}>
              SAVE {rows.length > 1 ? `${rows.length} BULLS` : 'STRAWS'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tank Inventory Tab ────────────────────────────────────────────────────────

export function TankInventoryTab() {
  const router = useRouter()
  const [items,       setItems]      = useState<InventoryItem[]>([])
  const [loading,     setLoading]    = useState(true)
  const [addOpen,     setAddOpen]    = useState(false)
  const [confirmItem, setConfirmItem]= useState<InventoryItem | null>(null)
  const [addQty,      setAddQty]     = useState<Record<string, string>>({})
  const [addOpen2,    setAddOpen2]   = useState<Record<string, boolean>>({})
  const [saving,      setSaving]     = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiGet('/api/genetics/tank')
      const d = await r.json()
      setItems(d.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function useStraw(item: InventoryItem) {
    const newCount = (item.straw_count ?? 0) - 1
    setSaving(s => ({ ...s, [item.id]: true }))
    try {
      await apiPatch('/api/genetics/tank', { id: item.id, straw_count: newCount })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, straw_count: newCount } : i))
    } finally {
      setSaving(s => ({ ...s, [item.id]: false }))
      setConfirmItem(null)
      const sireParam = item.sire_library_id ? `?sire=${item.sire_library_id}&inv=${item.id}` : ''
      router.push(`/reproduction/ai-session${sireParam}`)
    }
  }

  async function addStraws(item: InventoryItem) {
    const qty = Number(addQty[item.id] ?? '')
    if (!qty || qty <= 0) return
    const newCount = (item.straw_count ?? 0) + qty
    setSaving(s => ({ ...s, [item.id]: true }))
    try {
      await apiPatch('/api/genetics/tank', { id: item.id, straw_count: newCount })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, straw_count: newCount } : i))
      setAddQty(q => ({ ...q, [item.id]: '' }))
      setAddOpen2(o => ({ ...o, [item.id]: false }))
    } finally { setSaving(s => ({ ...s, [item.id]: false })) }
  }

  const totalBulls  = items.length
  const totalStraws = items.reduce((s, i) => s + (i.straw_count ?? 0), 0)
  const sexedStraws = items.filter(i => i.is_sexed).reduce((s, i) => s + (i.straw_count ?? 0), 0)
  const totalValue  = items.reduce((s, i) => s + (i.straw_count ?? 0) * (i.price_per_straw ?? 0), 0)

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>LEGACY TANK</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Bulls: <strong style={{ color: 'var(--text)' }}>{totalBulls}</strong>
            </span>
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Straws: <strong style={{ color: 'var(--text)' }}>{totalStraws}</strong>
            </span>
            {sexedStraws > 0 && (
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                Sexed: <strong style={{ color: 'var(--accent)' }}>{sexedStraws}</strong>
              </span>
            )}
            {totalValue > 0 && (
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                Value: <strong style={{ color: 'var(--text)' }}>${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
              </span>
            )}
          </div>
        </div>
        <Button intent="primary" size="sm" onClick={() => setAddOpen(true)}>+ ADD STRAWS</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState variant="neutral" title="No semen on record" body="Add your first bull to start tracking tank inventory." />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => {
            const bullName = item.sire_library?.bull_name ?? item.sire_name
            const breed    = item.sire_library?.breed ?? null
            const count    = item.straw_count ?? 0
            const sl       = item.sire_library
            const hasEpds  = sl && (sl.epd_ced != null || sl.epd_bw != null || sl.epd_ww != null || sl.epd_yw != null)
            const isOut    = count === 0

            return (
              <div key={item.id} className="rounded-xl overflow-hidden"
                style={{ border: '1.5px solid var(--border)', background: 'var(--surface-1)', opacity: isOut ? 0.65 : 1 }}>

                {/* Header row */}
                <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base" style={{ color: 'var(--text)' }}>{bullName}</span>
                    {breed && <Chip tone="neutral" size="sm">{breed}</Chip>}
                    {item.is_sexed && <Chip tone="info" size="sm">SEXED</Chip>}
                    {item.straw_size === '0.25cc' && <Chip tone="neutral" size="sm">1/4cc</Chip>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: strawCountColor(count) }}>{count}</p>
                    <p className="type-helper" style={{ color: 'var(--text-muted)' }}>straws</p>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 px-4 pb-2">
                  {item.price_per_straw != null && (
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Cost: <strong>${item.price_per_straw}/straw</strong></span>
                  )}
                  {item.tank_name && (
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Tank: <strong>{item.tank_name}</strong></span>
                  )}
                  {item.canister && (
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Canister: <strong>{item.canister}</strong></span>
                  )}
                  {item.cane && (
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Cane: <strong>{item.cane}</strong></span>
                  )}
                  {sl?.naab_code && (
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>NAAB: <strong>{sl.naab_code}</strong></span>
                  )}
                </div>

                {/* EPD strip */}
                {hasEpds && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                    {sl!.epd_ced      != null && <Chip tone="neutral" size="sm">CED: {sl!.epd_ced}</Chip>}
                    {sl!.epd_bw       != null && <Chip tone="neutral" size="sm">BW: {sl!.epd_bw}</Chip>}
                    {sl!.epd_ww       != null && <Chip tone="neutral" size="sm">WW: {sl!.epd_ww}</Chip>}
                    {sl!.epd_yw       != null && <Chip tone="neutral" size="sm">YW: {sl!.epd_yw}</Chip>}
                    {sl!.epd_marbling != null && <Chip tone="neutral" size="sm">Marb: {sl!.epd_marbling}</Chip>}
                  </div>
                )}

                {isOut && (
                  <div className="px-4 pb-3">
                    <Chip tone="danger" size="sm">OUT OF STOCK</Chip>
                  </div>
                )}

                {/* Actions */}
                {!isOut && (
                  <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
                    <Button intent="secondary" size="sm" loading={saving[item.id]}
                      onClick={() => setConfirmItem(item)}>
                      USE STRAW
                    </Button>
                    {addOpen2[item.id] ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="1" step="1"
                          value={addQty[item.id] ?? ''}
                          onChange={e => setAddQty(q => ({ ...q, [item.id]: e.target.value }))}
                          placeholder="Qty"
                          className="w-20 px-2 py-1 rounded text-sm"
                          style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
                        />
                        <Button intent="primary" size="sm" loading={saving[item.id]} onClick={() => addStraws(item)}>ADD</Button>
                        <Button intent="ghost" size="sm" onClick={() => setAddOpen2(o => ({ ...o, [item.id]: false }))}>CANCEL</Button>
                      </div>
                    ) : (
                      <Button intent="ghost" size="sm" onClick={() => setAddOpen2(o => ({ ...o, [item.id]: true }))}>ADD STRAWS</Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddStrawsSheet
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => { setAddOpen(false); load() }}
      />

      <ConfirmDialog
        isOpen={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onConfirm={() => confirmItem && useStraw(confirmItem)}
        title="Use 1 straw?"
        message={`Use 1 straw of ${confirmItem?.sire_library?.bull_name ?? confirmItem?.sire_name ?? 'this bull'}? You'll be taken to the AI session to record the breeding.`}
        confirmLabel="USE STRAW"
      />
    </div>
  )
}
