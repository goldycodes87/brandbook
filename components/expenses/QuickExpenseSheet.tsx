'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Camera, PenLine, MessageSquare, CheckSquare, Square, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost, apiGet } from '@/lib/fetch'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'select' | 'scan' | 'describe' | 'review' | 'manual'
type Scope = 'whole_herd' | 'lease_specific'
type ExpenseType = 'shared' | 'owner_specific' | 'animal_specific'

interface ParsedItem {
  id: string
  description: string
  amount: string
  category_name: string
  checked: boolean
}

interface CategoryRow { id: string; name: string; expense_type: string; calculation_type?: string | null }
interface LeaseOption  { id: string; property_name: string }
interface GrazingOwner { id: string; name: string; company_name: string | null; owner_name: string | null }

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const ALL_CATEGORIES = [
  'Hay / Forage', 'Protein / Mineral Tubs', 'Salt / Loose Mineral',
  'Pasture Treatment', 'Working Animals', 'Fence Repair',
  'Equipment Rental', 'Labor', 'Water / Utilities', 'Other (Shared)',
  'AI Technician Fee', 'Semen Straws', 'Preg Check', 'Other (Owner Specific)',
  'Vet Bill', 'Medication', 'Veterinary Procedure', 'Other (Animal Specific)',
]

function matchCategory(suggested: string, cats: CategoryRow[]): string {
  const exact = cats.find(c => c.name.toLowerCase() === suggested.toLowerCase())
  if (exact) return exact.name
  const partial = cats.find(c =>
    c.name.toLowerCase().includes(suggested.toLowerCase()) ||
    suggested.toLowerCase().includes(c.name.toLowerCase())
  )
  return partial?.name ?? 'Other (Shared)'
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function currentQtr(): 1|2|3|4 { return Math.ceil((new Date().getMonth() + 1) / 3) as 1|2|3|4 }
function currentYr() { return new Date().getFullYear() % 100 }
function uid() { return Math.random().toString(36).slice(2) }
function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) }

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickExpenseSheet({ isOpen, onClose, onSuccess }: Props) {
  const [mode,           setMode]          = useState<Mode>('select')
  // shared
  const [scope,          setScope]         = useState<Scope>('whole_herd')
  const [expQtr,         setExpQtr]        = useState<1|2|3|4>(currentQtr())
  const [expYear,        setExpYear]       = useState<number>(currentYr())
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null)
  const [leases,         setLeases]        = useState<LeaseOption[]>([])
  const [categories,     setCategories]    = useState<CategoryRow[]>([])
  const [owners,         setOwners]        = useState<GrazingOwner[]>([])
  const [isSaving,       setIsSaving]      = useState(false)
  const [saveError,      setSaveError]     = useState('')
  // scan / describe review
  const [parsedItems,    setParsedItems]   = useState<ParsedItem[]>([])
  const [receiptUrl,     setReceiptUrl]    = useState<string | null>(null)
  const [isScanning,     setIsScanning]    = useState(false)
  const [scanError,      setScanError]     = useState('')
  // describe
  const [describeText,   setDescribeText]  = useState('')
  const [isParsing,      setIsParsing]     = useState(false)
  const [parseError,     setParseError]    = useState('')
  const [leaseHint,      setLeaseHint]     = useState<string | null>(null)
  const [dateHint,       setDateHint]      = useState<string | null>(null)
  // manual
  const [expenseType,    setExpenseType]   = useState<ExpenseType>('shared')
  const [categoryName,   setCategoryName]  = useState('')
  const [categoryId,     setCategoryId]    = useState<string | null>(null)
  const [amount,         setAmount]        = useState('')
  const [expenseDate,    setExpenseDate]   = useState(todayStr())
  const [description,    setDescription]   = useState('')
  const [ownerId,        setOwnerId]       = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    // reset
    setMode('select')
    setParsedItems([]); setReceiptUrl(null); setScanError(''); setParseError(''); setSaveError('')
    setDescribeText(''); setLeaseHint(null); setDateHint(null)
    setScope('whole_herd'); setExpQtr(currentQtr()); setExpYear(currentYr()); setSelectedLeaseId(null)
    setCategoryName(''); setCategoryId(null); setAmount(''); setExpenseDate(todayStr())
    setDescription(''); setOwnerId(null); setExpenseType('shared')

    apiGet('/api/expenses/categories').then(r => r.json()).then(d => {
      const all: CategoryRow[] = []
      const grouped = d.data ?? {}
      for (const arr of Object.values(grouped)) all.push(...(arr as CategoryRow[]))
      setCategories(all)
    }).catch(() => {})

    apiGet('/api/leases').then(r => r.json()).then(d => setLeases(d.data ?? [])).catch(() => {})
    apiGet('/api/grazing-owners?limit=100').then(r => r.json()).then(d => setOwners(d.data ?? [])).catch(() => {})
  }, [isOpen])

  // ── Receipt scan ────────────────────────────────────────────────────────────

  async function handleScan(file: File) {
    setIsScanning(true); setScanError('')
    try {
      // Parallel: AI parse + R2 upload
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res((r.result as string).split(',')[1])
          r.onerror = rej
          r.readAsDataURL(f)
        })

      const [base64Data, presignRes] = await Promise.all([
        toBase64(file),
        fetch('/api/expenses/receipts/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: file.type }),
        }).then(r => r.json()),
      ])

      // Upload to R2 + call AI in parallel
      const [, parseRes] = await Promise.all([
        fetch(presignRes.presigned_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        }),
        fetch('/api/ai/parse-expense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'receipt', image_base64: base64Data, media_type: file.type }),
        }).then(r => r.json()),
      ])

      setReceiptUrl(presignRes.public_url ?? null)

      if (parseRes.error || !parseRes.items?.length) {
        setScanError('No expenses found. Try a clearer photo or manual entry.')
        setMode('scan')
        return
      }

      setParsedItems(parseRes.items.map((item: { description: string; amount: number; suggested_category: string }) => ({
        id:            uid(),
        description:   item.description,
        amount:        String(item.amount ?? ''),
        category_name: matchCategory(item.suggested_category ?? '', categories),
        checked:       true,
      })))

      // Auto-fill date from receipt if found
      if (parseRes.date) setExpenseDate(parseRes.date)
      setMode('review')
    } catch {
      setScanError("Couldn't read that. Try manual entry.")
      setMode('scan')
    } finally {
      setIsScanning(false)
    }
  }

  // ── Natural language parse ───────────────────────────────────────────────────

  async function handleParse() {
    if (!describeText.trim()) return
    setIsParsing(true); setParseError('')
    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'text', text: describeText }),
      })
      const data = await res.json()

      if (data.error || !data.items?.length) {
        setParseError("No expenses found. Try manual entry.")
        return
      }

      setParsedItems(data.items.map((item: { description: string; amount: number; suggested_category: string }) => ({
        id:            uid(),
        description:   item.description,
        amount:        String(item.amount ?? ''),
        category_name: matchCategory(item.suggested_category ?? '', categories),
        checked:       true,
      })))

      if (data.date_hint)  setExpenseDate(data.date_hint)
      if (data.lease_hint) setLeaseHint(data.lease_hint)
      setDateHint(data.date_hint ?? null)
      setMode('review')
    } catch {
      setParseError("Parse failed. Try manual entry.")
    } finally {
      setIsParsing(false)
    }
  }

  // ── Save parsed items ────────────────────────────────────────────────────────

  async function handleSaveItems() {
    const checked = parsedItems.filter(i => i.checked && parseFloat(i.amount) > 0)
    if (!checked.length) { setSaveError('No items selected'); return }

    const effectiveLeaseId = selectedLeaseId
    if (scope === 'lease_specific' && !effectiveLeaseId) {
      setSaveError('Select a lease'); return
    }

    setIsSaving(true); setSaveError('')
    try {
      const isWH = scope === 'whole_herd'
      const yr   = 2000 + expYear
      const pStart = new Date(yr, (expQtr - 1) * 3, 1).toISOString().slice(0, 10)
      const pEnd   = new Date(yr, expQtr * 3, 0).toISOString().slice(0, 10)

      await Promise.all(checked.map(item => {
        const payload = {
          category_name:    item.category_name,
          expense_type:     'shared',
          description:      item.description || null,
          total_amount:     parseFloat(item.amount),
          expense_date:     expenseDate || null,
          period_start:     pStart,
          period_end:       pEnd,
          is_lease_specific: !isWH,
          quarter:          isWH ? expQtr : undefined,
          year:             isWH ? expYear : undefined,
          receipt_url:      receiptUrl ?? null,
        }
        const url = isWH
          ? '/api/expenses'
          : `/api/leases/${effectiveLeaseId}/expenses`
        return apiPost(url, payload)
      }))

      onSuccess(); onClose()
    } catch {
      setSaveError('Save failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Save manual expense ──────────────────────────────────────────────────────

  async function handleSaveManual() {
    const amt = parseFloat(amount)
    if (!categoryName || isNaN(amt) || amt <= 0) { setSaveError('Category and amount required'); return }
    if (expenseType === 'owner_specific' && !ownerId) { setSaveError('Select an owner'); return }

    const isWH = expenseType === 'shared' && scope === 'whole_herd'
    const effectiveLeaseId = selectedLeaseId
    if (expenseType === 'shared' && scope === 'lease_specific' && !effectiveLeaseId) {
      setSaveError('Select a lease'); return
    }

    setIsSaving(true); setSaveError('')
    try {
      const yr     = 2000 + expYear
      const pStart = new Date(yr, (expQtr - 1) * 3, 1).toISOString().slice(0, 10)
      const pEnd   = new Date(yr, expQtr * 3, 0).toISOString().slice(0, 10)

      const payload = {
        category_name:    categoryName,
        category_id:      categoryId,
        expense_type:     expenseType,
        description:      description.trim() || null,
        total_amount:     amt,
        expense_date:     expenseDate || null,
        period_start:     isWH ? pStart : null,
        period_end:       isWH ? pEnd   : null,
        is_lease_specific: !isWH,
        quarter:          isWH ? expQtr  : undefined,
        year:             isWH ? expYear : undefined,
        owner_id:         expenseType === 'owner_specific' ? (ownerId === 'null' ? null : ownerId) : null,
      }

      const url = isWH || expenseType === 'owner_specific'
        ? '/api/expenses'
        : `/api/leases/${effectiveLeaseId}/expenses`

      const res  = await apiPost(url, payload)
      const json = await res.json()
      if (!res.ok) { setSaveError(json.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } catch {
      setSaveError('Save failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  // ── Shared: scope + quarter selector ────────────────────────────────────────

  function ScopeSelector() {
    return (
      <div className="flex flex-col gap-2">
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>EXPENSE SCOPE</p>
        <div className="flex flex-col gap-2">
          {([
            { val: 'whole_herd' as Scope,   emoji: '🌾', label: 'WHOLE HERD',     sub: 'Split across all owners by herd %' },
            { val: 'lease_specific' as Scope, emoji: '🏡', label: 'LEASE SPECIFIC', sub: 'Only animals on a specific lease' },
          ]).map(({ val, emoji, label, sub }) => (
            <button key={val} type="button" onClick={() => setScope(val)}
              className="flex items-start gap-3 p-3 rounded-xl text-left"
              style={{ border: `2px solid ${scope === val ? 'var(--accent)' : 'var(--border)'}`, background: scope === val ? 'var(--accent-soft)' : 'var(--surface-1)' }}>
              <span className="text-xl">{emoji}</span>
              <div>
                <p className="text-xs font-bold" style={{ color: scope === val ? 'var(--accent)' : 'var(--text)' }}>{label}</p>
                <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {scope === 'whole_herd' && (
          <>
            <p className="type-section-label mt-1" style={{ color: 'var(--text-muted)' }}>WHICH QUARTER?</p>
            <div className="flex items-center gap-2">
              <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {([1,2,3,4] as const).map((q, i) => (
                  <button key={q} type="button" onClick={() => setExpQtr(q)}
                    className="px-3 py-1.5 text-xs font-semibold"
                    style={{ background: expQtr === q ? 'var(--accent)' : 'var(--surface-1)', color: expQtr === q ? 'white' : 'var(--text-muted)', borderRight: i < 3 ? '1px solid var(--border)' : undefined }}>
                    Q{q}
                  </button>
                ))}
              </div>
              <select value={expYear} onChange={e => setExpYear(Number(e.target.value))}
                className="text-sm rounded px-2 py-1.5"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {Array.from({ length: 4 }, (_, i) => currentYr() - i + 1).map(y => (
                  <option key={y} value={y}>{2000 + y}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {scope === 'lease_specific' && (
          <Field label="Which lease?" required>
            <div className="flex flex-col gap-1.5 mt-1">
              {leases.map(l => (
                <button key={l.id} type="button" onClick={() => setSelectedLeaseId(l.id)}
                  className="text-left px-3 py-2.5 rounded-lg"
                  style={{ border: `1.5px solid ${selectedLeaseId === l.id ? 'var(--accent)' : 'var(--border)'}`, background: selectedLeaseId === l.id ? 'var(--accent-soft)' : 'var(--surface-1)', color: selectedLeaseId === l.id ? 'var(--accent)' : 'var(--text)' }}>
                  {l.property_name}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
    )
  }

  // ── Shared: parsed items review ──────────────────────────────────────────────

  function ItemReview() {
    const checkedCount  = parsedItems.filter(i => i.checked).length
    const checkedTotal  = parsedItems.filter(i => i.checked).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    const allChecked    = parsedItems.every(i => i.checked)

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>
            {parsedItems.length} ITEM{parsedItems.length !== 1 ? 'S' : ''} FOUND
          </p>
          <button type="button" className="type-helper" style={{ color: 'var(--accent)' }}
            onClick={() => setParsedItems(p => p.map(i => ({ ...i, checked: !allChecked })))}>
            {allChecked ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {parsedItems.map(item => (
          <div key={item.id} className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${item.checked ? 'var(--accent)' : 'var(--border)'}` }}>
            <div className="flex items-center gap-3 px-3 py-2.5"
              style={{ background: item.checked ? 'var(--accent-soft)' : 'var(--surface-1)', cursor: 'pointer' }}
              onClick={() => setParsedItems(p => p.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i))}>
              {item.checked
                ? <CheckSquare size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                : <Square      size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
                {item.description}
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--gold-fg)' }}>
                {fmt(parseFloat(item.amount) || 0)}
              </span>
            </div>
            {item.checked && (
              <div className="px-3 pb-3 pt-1.5 flex flex-col gap-2" style={{ background: 'var(--surface-0)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="type-helper mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>DESCRIPTION</p>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => setParsedItems(p => p.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                  <div>
                    <p className="type-helper mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>AMOUNT ($)</p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={e => setParsedItems(p => p.map(i => i.id === item.id ? { ...i, amount: e.target.value } : i))}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                </div>
                <div>
                  <p className="type-helper mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>CATEGORY</p>
                  <select
                    value={item.category_name}
                    onChange={e => setParsedItems(p => p.map(i => i.id === item.id ? { ...i, category_name: e.target.value } : i))}
                    className="w-full px-2 py-1.5 rounded text-sm"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-between items-center px-1">
          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{checkedCount} selected</span>
          <span className="font-bold" style={{ color: 'var(--gold-fg)' }}>Total: {fmt(checkedTotal)}</span>
        </div>

        <Field label="Date">
          <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
        </Field>

        <ScopeSelector />

        {leaseHint && (
          <ContextBanner tone="info">
            Mentioned: <strong>{leaseHint}</strong> — select the correct lease above if applicable.
          </ContextBanner>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const checkedCount = parsedItems.filter(i => i.checked).length

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl md:rounded-2xl flex flex-col w-full md:max-w-lg"
        style={{ background: 'var(--surface-0)', maxHeight: '92dvh', height: '92dvh', touchAction: 'pan-y' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            {mode !== 'select' && (
              <button type="button" className="type-helper mb-0.5 flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => mode === 'review' ? setMode('scan') : setMode('select')}>
                ← Back
              </button>
            )}
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>LOG EXPENSE</h2>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pb-4 flex flex-col gap-4 overflow-y-scroll" style={{ overscrollBehavior: 'contain', minHeight: 0 }}>

          {/* ── MODE SELECT ─────────────────────────────────────────── */}
          {mode === 'select' && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>HOW WOULD YOU LIKE TO LOG?</p>
              {([
                { m: 'scan' as Mode,     Icon: Camera,       label: 'SCAN RECEIPT',  sub: 'Take or upload a photo' },
                { m: 'manual' as Mode,   Icon: PenLine,      label: 'MANUAL ENTRY',  sub: 'Enter expense details' },
                { m: 'describe' as Mode, Icon: MessageSquare, label: 'DESCRIBE IT',  sub: '"Spent $1800 on hay and tubs today"' },
              ]).map(({ m, Icon, label, sub }) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                  style={{ border: '2px solid var(--border)', background: 'var(--surface-1)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-soft)' }}>
                    <Icon size={20} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{label}</p>
                    <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* ── SCAN RECEIPT ────────────────────────────────────────── */}
          {mode === 'scan' && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>SCAN RECEIPT</p>

              {isScanning ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Reading receipt…</p>
                </div>
              ) : (
                <>
                  <label
                    className="flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer"
                    style={{ border: '2px dashed var(--border)', background: 'var(--surface-1)', minHeight: '220px', padding: '32px' }}
                  >
                    <Upload size={36} style={{ color: 'var(--accent)' }} />
                    <div className="text-center">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Tap to take photo</p>
                      <p className="type-helper" style={{ color: 'var(--text-muted)' }}>or choose from library</p>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleScan(f)
                        e.target.value = ''
                      }}
                    />
                  </label>

                  {scanError && (
                    <ContextBanner tone="warning">{scanError}</ContextBanner>
                  )}
                </>
              )}
            </>
          )}

          {/* ── DESCRIBE IT ─────────────────────────────────────────── */}
          {mode === 'describe' && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>DESCRIBE THE EXPENSE</p>

              <Field label="What did you buy?">
                <Textarea
                  value={describeText}
                  onChange={e => setDescribeText(e.target.value)}
                  rows={4}
                  placeholder='e.g. "Spent $1800 on hay and mineral tubs at Vandermiller today"'
                />
              </Field>

              {parseError && <ContextBanner tone="warning">{parseError}</ContextBanner>}

              <Button type="button" intent="primary" size="sm"
                loading={isParsing}
                disabled={!describeText.trim()}
                onClick={handleParse}>
                PARSE
              </Button>
            </>
          )}

          {/* ── REVIEW (scan or describe) ────────────────────────────── */}
          {mode === 'review' && <ItemReview />}

          {/* ── MANUAL ENTRY ─────────────────────────────────────────── */}
          {mode === 'manual' && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>EXPENSE TYPE</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { t: 'shared' as ExpenseType,          emoji: '🌾', label: 'SHARED',  sub: 'Herd %' },
                  { t: 'owner_specific' as ExpenseType,  emoji: '👤', label: 'OWNER',   sub: 'One owner' },
                  { t: 'animal_specific' as ExpenseType, emoji: '🐄', label: 'ANIMAL',  sub: 'One animal' },
                ]).map(({ t, emoji, label, sub }) => (
                  <button key={t} type="button" onClick={() => { setExpenseType(t); setCategoryName(''); setCategoryId(null) }}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl text-center"
                    style={{ border: `2px solid ${expenseType === t ? 'var(--accent)' : 'var(--border)'}`, background: expenseType === t ? 'var(--accent-soft)' : 'var(--surface-1)' }}>
                    <span className="text-xl">{emoji}</span>
                    <span className="text-xs font-bold" style={{ color: expenseType === t ? 'var(--accent)' : 'var(--text)' }}>{label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{sub}</span>
                  </button>
                ))}
              </div>

              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>CATEGORY</p>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                {categories
                  .filter(c => {
                    if (expenseType === 'shared')          return c.expense_type === 'shared'
                    if (expenseType === 'owner_specific')  return c.expense_type === 'owner_specific'
                    if (expenseType === 'animal_specific') return c.expense_type === 'animal_specific'
                    return true
                  })
                  .map((cat, i, arr) => (
                    <button key={cat.id} type="button" onClick={() => { setCategoryId(cat.id); setCategoryName(cat.name) }}
                      className="text-left px-4 py-2.5 text-sm transition-all"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : undefined, background: categoryName === cat.name ? 'var(--accent-soft)' : 'transparent', color: categoryName === cat.name ? 'var(--accent)' : 'var(--text)', fontWeight: categoryName === cat.name ? 600 : 400 }}>
                      {cat.name}
                    </button>
                  ))}
              </div>

              {expenseType === 'owner_specific' && (
                <>
                  <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>OWNER</p>
                  <div className="flex flex-col gap-1.5">
                    {owners.map(o => {
                      const name = o.company_name || o.owner_name || o.name
                      return (
                        <button key={o.id} type="button" onClick={() => setOwnerId(o.id)}
                          className="text-left px-3 py-2.5 rounded-lg"
                          style={{ border: `1.5px solid ${ownerId === o.id ? 'var(--accent)' : 'var(--border)'}`, background: ownerId === o.id ? 'var(--accent-soft)' : 'var(--surface-1)', color: ownerId === o.id ? 'var(--accent)' : 'var(--text)' }}>
                          {name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {expenseType === 'shared' && <ScopeSelector />}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount ($)" required>
                  <Input type="number" step="0.01" min="0" value={amount}
                    onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Date">
                  <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                </Field>
              </div>

              <Field label="Description">
                <Input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Optional notes" />
              </Field>
            </>
          )}

          {/* Error */}
          {saveError && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {saveError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>

          {mode === 'review' && (
            <Button type="button" intent="primary" size="sm" className="flex-1"
              loading={isSaving}
              disabled={checkedCount === 0}
              onClick={handleSaveItems}>
              SAVE {checkedCount} EXPENSE{checkedCount !== 1 ? 'S' : ''}
            </Button>
          )}

          {mode === 'manual' && (
            <Button type="button" intent="primary" size="sm" className="flex-1"
              loading={isSaving}
              onClick={handleSaveManual}>
              SAVE EXPENSE
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
