'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

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

function strawCountColor(n: number | null): string {
  if (!n || n === 0) return 'var(--danger-fg)'
  if (n <= 2) return '#c87a00'
  return 'var(--success-fg)'
}

// ── Add Semen Sheet ───────────────────────────────────────────────────────────

function AddSemenSheet({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [search,        setSearch]       = useState('')
  const [results,       setResults]      = useState<SireLookup[]>([])
  const [searching,     setSearching]    = useState(false)
  const [selectedSire,  setSelectedSire] = useState<SireLookup | null>(null)
  const [tankName,      setTankName]     = useState('Legacy Tank')
  const [canister,      setCanister]     = useState('')
  const [cane,          setCane]         = useState('')
  const [qty,           setQty]          = useState('')
  const [pricePerStraw, setPricePerStraw]= useState('')
  const [strawSize,     setStrawSize]    = useState<'0.5cc' | '0.25cc'>('0.5cc')
  const [isSexed,       setIsSexed]      = useState(false)
  const [purchaseDate,  setPurchaseDate] = useState('')
  const [notes,         setNotes]        = useState('')
  const [saving,        setSaving]       = useState(false)
  const [error,         setError]        = useState('')

  useEffect(() => {
    if (!isOpen) {
      setSearch(''); setResults([]); setSelectedSire(null)
      setTankName('Legacy Tank'); setCanister(''); setCane('')
      setQty(''); setPricePerStraw(''); setStrawSize('0.5cc')
      setIsSexed(false); setPurchaseDate(''); setNotes(''); setError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await apiGet(`/api/genetics/sires?search=${encodeURIComponent(search)}&limit=8`)
        const d = await r.json()
        setResults((d.data ?? []).map((s: { id: string; bull_name: string; breed: string | null; naab_code: string | null }) => ({
          id: s.id, bull_name: s.bull_name, breed: s.breed, naab_code: s.naab_code,
        })))
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleSave = async () => {
    if (!selectedSire) { setError('Select a bull first'); return }
    const count = Number(qty)
    if (!count || count <= 0) { setError('Enter a straw count'); return }
    setSaving(true); setError('')
    try {
      const r = await apiPost('/api/genetics/tank', {
        sire_library_id: selectedSire.id,
        straw_count:     count,
        tank_name:       tankName || 'Legacy Tank',
        canister:        canister || null,
        cane:            cane || null,
        price_per_straw: pricePerStraw ? Number(pricePerStraw) : null,
        straw_size:      strawSize,
        is_sexed:        isSexed,
        purchase_date:   purchaseDate || null,
        notes:           notes || null,
      })
      if (!r.ok) { const d = await r.json(); setError(d.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-t-2xl md:rounded-2xl flex flex-col w-full md:max-w-lg"
        style={{ background: 'var(--surface-0)', maxHeight: '92dvh' }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>ADD SEMEN</h2>
          <button type="button" onClick={onClose} className="text-xl font-bold" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <div className="flex-1 px-5 pb-4 flex flex-col gap-4 overflow-y-scroll" style={{ minHeight: 0 }}>
          {/* Bull search */}
          <Field label="Bull" required>
            {selectedSire ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                style={{ border: '2px solid var(--accent)', background: 'var(--accent-soft)' }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{selectedSire.bull_name}</p>
                  {selectedSire.breed && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{selectedSire.breed}</p>}
                </div>
                <button type="button" className="type-helper" style={{ color: 'var(--text-muted)' }} onClick={() => setSelectedSire(null)}>change</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by bull name…"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)' }}
                />
                {searching && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
                {results.length > 0 && (
                  <div className="rounded-lg overflow-hidden mt-1" style={{ border: '1px solid var(--border)' }}>
                    {results.map(s => (
                      <button key={s.id} type="button" onClick={() => { setSelectedSire(s); setSearch(''); setResults([]) }}
                        className="w-full text-left px-3 py-2.5 text-sm"
                        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)' }}>
                        <span className="font-semibold">{s.bull_name}</span>
                        {s.breed && <span className="ml-2 type-helper" style={{ color: 'var(--text-muted)' }}>{s.breed}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Straw Count" required>
              <Input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 10" />
            </Field>
            <Field label="Cost Per Straw ($)">
              <Input type="number" min="0" step="0.01" value={pricePerStraw} onChange={e => setPricePerStraw(e.target.value)} placeholder="0.00" />
            </Field>
          </div>

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

          <Field label="Straw Size">
            <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {([['0.5cc', '1/2cc'], ['0.25cc', '1/4cc']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setStrawSize(val)}
                  className="flex-1 px-3 py-2 text-xs font-semibold"
                  style={{
                    background: strawSize === val ? 'var(--accent)' : 'var(--surface-1)',
                    color:      strawSize === val ? 'white' : 'var(--text-muted)',
                    borderRight: val === '0.5cc' ? '1px solid var(--border)' : undefined,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isSexed} onChange={e => setIsSexed(e.target.checked)} className="rounded" />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Sexed Semen</span>
          </label>

          <Field label="Purchase Date">
            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
          </Field>

          {error && <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>{error}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          <Button type="button" intent="primary" size="sm" className="flex-1" loading={saving} onClick={handleSave}>SAVE SEMEN</Button>
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
      // Navigate to AI session pre-filled
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
          <div className="flex gap-4 mt-1">
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Bulls: <strong style={{ color: 'var(--text)' }}>{totalBulls}</strong></span>
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Straws: <strong style={{ color: 'var(--text)' }}>{totalStraws}</strong></span>
            {sexedStraws > 0 && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Sexed: <strong style={{ color: 'var(--accent)' }}>{sexedStraws}</strong></span>}
          </div>
        </div>
        <Button intent="primary" size="sm" onClick={() => setAddOpen(true)}>+ ADD SEMEN</Button>
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
                    {sl!.epd_ced  != null && <Chip tone="neutral" size="sm">CED: {sl!.epd_ced}</Chip>}
                    {sl!.epd_bw   != null && <Chip tone="neutral" size="sm">BW: {sl!.epd_bw}</Chip>}
                    {sl!.epd_ww   != null && <Chip tone="neutral" size="sm">WW: {sl!.epd_ww}</Chip>}
                    {sl!.epd_yw   != null && <Chip tone="neutral" size="sm">YW: {sl!.epd_yw}</Chip>}
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

      <AddSemenSheet isOpen={addOpen} onClose={() => setAddOpen(false)} onSuccess={() => { setAddOpen(false); load() }} />

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
