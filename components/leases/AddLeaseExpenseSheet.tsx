'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost, apiPatch, apiGet } from '@/lib/fetch'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaseExpense {
  id: string
  lease_id: string
  category_name: string
  category_id: string | null
  expense_type: string
  description: string | null
  total_amount: number
  expense_date: string | null
  receipt_url: string | null
  period_start: string | null
  period_end: string | null
  owner_id: string | null
  animal_id: string | null
  notes: string | null
  qty: number | null
  unit_cost: number | null
  sire_library_id: string | null
  bull_name: string | null
  include_calves: boolean | null
  created_at: string
}

const REQUIRES_DESCRIPTION = [
  'Labor',
  'Equipment Rental',
  'Veterinary Procedure',
  'Other (Shared)',
  'Other (Owner Specific)',
  'Other (Animal Specific)',
]

const WORKING_ITEMS = ['Wormer', 'Ear Tags', 'Branding', 'Vet Check', 'Wound Care', 'Vaccines', 'Other']

function todayStr() { return new Date().toISOString().slice(0, 10) }
function qtrStartStr() {
  const now = new Date()
  const qStart = Math.floor(now.getMonth() / 3) * 3
  return new Date(now.getFullYear(), qStart, 1).toISOString().slice(0, 10)
}

interface CategoryRow { id: string; name: string; expense_type: string; calculation_type?: string | null }

interface AumOwnerRow {
  owner_id: string | null
  owner_name: string
  billable: number
  percent_of_herd: number
}

interface GrazingOwner { id: string; name: string; company_name: string | null; owner_name: string | null }
interface LeaseAnimal  { id: string; tag_number: string; name: string | null; ear_tag_color: string | null; sex: string | null }

type ExpenseType = 'shared' | 'owner_specific' | 'animal_specific'

const TYPE_CONFIG: Record<ExpenseType, { emoji: string; label: string; sub: string }> = {
  shared:          { emoji: '🌾', label: 'SHARED',         sub: 'Split by herd %' },
  owner_specific:  { emoji: '👤', label: 'OWNER SPECIFIC', sub: 'One owner' },
  animal_specific: { emoji: '🐄', label: 'ANIMAL SPECIFIC', sub: 'One animal' },
}

interface Props {
  isOpen: boolean
  onClose: () => void
  leaseId: string
  leaseName?: string
  ranchName?: string
  onSuccess: () => void
  initialData?: LeaseExpense | null
  mode?: 'create' | 'edit'
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddLeaseExpenseSheet({
  isOpen, onClose, leaseId, leaseName, ranchName = 'My Ranch', onSuccess, initialData, mode = 'create',
}: Props) {
  const [step,          setStep]         = useState<1 | 2 | 3 | 4>(1)
  const [expenseType,   setExpenseType]  = useState<ExpenseType>('shared')
  const [categories,    setCategories]   = useState<Record<ExpenseType, CategoryRow[]>>({ shared: [], owner_specific: [], animal_specific: [] })
  const [categoryId,    setCategoryId]   = useState<string | null>(null)
  const [categoryName,  setCategoryName] = useState('')
  const [description,   setDescription]  = useState('')
  const [expenseDate,   setExpenseDate]  = useState(new Date().toISOString().slice(0, 10))
  const [totalAmount,   setTotalAmount]  = useState('')
  const [quantity,      setQuantity]     = useState('')
  const [unitCost,      setUnitCost]     = useState('')
  const [notes,         setNotes]        = useState('')
  const [ownerId,       setOwnerId]      = useState<string | null>(null)
  const [animalId,      setAnimalId]     = useState<string | null>(null)
  const [animalSearch,  setAnimalSearch] = useState('')
  const [owners,        setOwners]       = useState<GrazingOwner[]>([])
  const [animals,       setAnimals]      = useState<LeaseAnimal[]>([])
  const [aumData,       setAumData]      = useState<{ by_owner: AumOwnerRow[] } | null>(null)
  const [includeCalves, setIncludeCalves] = useState(false)
  const [calcType,      setCalcType]     = useState<'period' | 'one_time'>('period')
  const [periodStart,   setPeriodStart]  = useState(qtrStartStr())
  const [periodEnd,     setPeriodEnd]    = useState(todayStr())
  const [workingItems,  setWorkingItems] = useState<string[]>([])
  const [otherDetail,   setOtherDetail]  = useState('')
  const [saving,        setSaving]       = useState(false)
  const [error,         setError]        = useState('')

  // Load categories + owners + animals + AUM on open
  useEffect(() => {
    if (!isOpen) return

    apiGet('/api/expenses/categories').then(r => r.json()).then(d => {
      setCategories(d.data ?? { shared: [], owner_specific: [], animal_specific: [] })
    }).catch(() => {})

    apiGet('/api/grazing-owners?limit=100').then(r => r.json()).then(d => {
      setOwners(d.data ?? [])
    }).catch(() => {})

    apiGet(`/api/leases/${leaseId}/animals`).then(r => r.json()).then(d => {
      setAnimals(d.data ?? [])
    }).catch(() => {})

    apiGet(`/api/leases/${leaseId}/aum`).then(r => r.json()).then(d => {
      if (!d.error) setAumData(d)
    }).catch(() => {})

    // Populate from initialData when editing
    if (mode === 'edit' && initialData) {
      setExpenseType((initialData.expense_type as ExpenseType) || 'shared')
      setCategoryId(initialData.category_id)
      setCategoryName(initialData.category_name)
      setDescription(initialData.description ?? '')
      setExpenseDate(initialData.expense_date ?? todayStr())
      setTotalAmount(String(initialData.total_amount ?? ''))
      setQuantity(initialData.qty != null ? String(initialData.qty) : '')
      setUnitCost(initialData.unit_cost != null ? String(initialData.unit_cost) : '')
      setNotes(initialData.notes ?? '')
      setOwnerId(initialData.owner_id)
      setAnimalId(initialData.animal_id)
      setIncludeCalves(Boolean(initialData.include_calves))
      const ct: 'period' | 'one_time' = initialData.period_start ? 'period' : 'one_time'
      setCalcType(ct)
      setPeriodStart(initialData.period_start ?? qtrStartStr())
      setPeriodEnd(initialData.period_end ?? todayStr())
      setWorkingItems([])
      setOtherDetail('')
      setStep(2)
    } else {
      setStep(1)
      setExpenseType('shared')
      setCategoryId(null)
      setCategoryName('')
      setDescription('')
      setExpenseDate(todayStr())
      setTotalAmount('')
      setQuantity('')
      setUnitCost('')
      setNotes('')
      setOwnerId(null)
      setAnimalId(null)
      setAnimalSearch('')
      setIncludeCalves(false)
      setCalcType('period')
      setPeriodStart(qtrStartStr())
      setPeriodEnd(todayStr())
      setWorkingItems([])
      setOtherDetail('')
    }
    setError('')
  }, [isOpen, leaseId, mode, initialData])

  const descriptionRequired  = REQUIRES_DESCRIPTION.includes(categoryName)
  const isWorkingAnimals     = categoryName === 'Working Animals'
  const isAITech             = categoryName === 'AI Technician Fee'
  const isPregCheck          = categoryName === 'Preg Check'
  const showQtyField         = isAITech || isPregCheck

  // Auto-calc total for Semen Straws
  const isSemenStraws = categoryName === 'Semen Straws'
  const computedTotal = isSemenStraws && quantity && unitCost
    ? String(Math.round(parseFloat(quantity) * parseFloat(unitCost) * 100) / 100)
    : totalAmount

  const activeCats = categories[expenseType] ?? []
  const selectedOwner  = owners.find(o => o.id === ownerId)
  const selectedAnimal = animals.find(a => a.id === animalId)
  const filteredAnimals = animalSearch
    ? animals.filter(a =>
        a.tag_number.toLowerCase().includes(animalSearch.toLowerCase()) ||
        (a.name ?? '').toLowerCase().includes(animalSearch.toLowerCase())
      )
    : animals

  const ownerDisplay = (o: GrazingOwner) => o.company_name || o.owner_name || o.name

  const handleSave = async () => {
    const amt = parseFloat(computedTotal)
    if (!categoryName || isNaN(amt)) { setError('Category and amount are required'); return }
    if (expenseType === 'owner_specific' && ownerId === null) { setError('Select an owner'); return }
    if (expenseType === 'animal_specific' && !animalId) { setError('Select an animal'); return }
    if (descriptionRequired && !description.trim()) { setError('Description is required for this expense type'); return }

    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        category_name:   categoryName,
        category_id:     categoryId,
        expense_type:    expenseType,
        description:     description.trim() || null,
        total_amount:    amt,
        expense_date:    calcType === 'one_time' ? (expenseDate || null) : (periodStart || null),
        period_start:    calcType === 'period' ? (periodStart || null) : null,
        period_end:      calcType === 'period' ? (periodEnd || null) : null,
        notes:           notes || null,
        owner_id:        expenseType === 'owner_specific'  ? (ownerId === 'null' ? null : ownerId)  : null,
        animal_id:       expenseType === 'animal_specific' ? animalId : null,
        qty:             quantity ? parseFloat(quantity) : null,
        unit_cost:       unitCost ? parseFloat(unitCost) : null,
        include_calves:  expenseType === 'shared' ? includeCalves : false,
      }

      const url = mode === 'edit' && initialData
        ? `/api/leases/${leaseId}/expenses/${initialData.id}`
        : `/api/leases/${leaseId}/expenses`
      const res  = await (mode === 'edit' ? apiPatch(url, payload) : apiPost(url, payload))
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl md:rounded-2xl flex flex-col w-full md:max-w-lg"
        style={{ background: 'var(--surface-0)', maxHeight: '92dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>
              {leaseName ? leaseName.toUpperCase() : 'EXPENSE'}
            </p>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {mode === 'edit' ? 'EDIT EXPENSE' : 'LOG EXPENSE'}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1 px-5 pb-3 flex-shrink-0">
          {([1, 2, 3, 4] as const).map(s => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full"
              style={{
                background: step >= s ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 flex flex-col gap-4">

          {/* ── STEP 1: Expense type ──────────────────────────────────────── */}
          {step === 1 && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>STEP 1 — EXPENSE TYPE</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TYPE_CONFIG) as [ExpenseType, typeof TYPE_CONFIG[ExpenseType]][]).map(([type, cfg]) => (
                  <button
                    key={type}
                    type="button"
                    className="flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all"
                    style={{
                      border: `2px solid ${expenseType === type ? 'var(--accent)' : 'var(--border)'}`,
                      background: expenseType === type ? 'var(--accent-soft)' : 'var(--surface-1)',
                    }}
                    onClick={() => setExpenseType(type)}
                  >
                    <span className="text-2xl">{cfg.emoji}</span>
                    <span className="type-label font-bold text-xs" style={{ color: expenseType === type ? 'var(--accent)' : 'var(--text)' }}>
                      {cfg.label}
                    </span>
                    <span className="type-helper" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      {cfg.sub}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2: Category ──────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>
                STEP 2 — CATEGORY
              </p>

              <div className="flex flex-col gap-1.5">
                {activeCats.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className="text-left px-4 py-3 rounded-xl transition-all"
                    style={{
                      border:     `1.5px solid ${categoryId === cat.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: categoryId === cat.id ? 'var(--accent-soft)' : 'var(--surface-1)',
                      color:      categoryId === cat.id ? 'var(--accent)' : 'var(--text)',
                      fontWeight: categoryId === cat.id ? 600 : 400,
                    }}
                    onClick={() => {
                      setCategoryId(cat.id)
                      setCategoryName(cat.name)
                      const ct = (cat.calculation_type || 'period') as 'period' | 'one_time'
                      setCalcType(ct)
                      if (cat.name === 'Working Animals') {
                        setIncludeCalves(true)
                        setWorkingItems([])
                        setOtherDetail('')
                        setDescription('')
                      } else if (!REQUIRES_DESCRIPTION.includes(cat.name)) {
                        setDescription(cat.name)
                      } else {
                        setDescription('')
                      }
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Owner selector for owner_specific */}
              {expenseType === 'owner_specific' && (
                <Field label="Owner" required>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {/* Ranch (null owner) first */}
                    <button
                      type="button"
                      className="text-left px-3 py-2.5 rounded-lg transition-all"
                      style={{
                        border:     `1.5px solid ${ownerId === 'null' ? 'var(--accent)' : 'var(--border)'}`,
                        background: ownerId === 'null' ? 'var(--accent-soft)' : 'var(--surface-1)',
                        color:      ownerId === 'null' ? 'var(--accent)' : 'var(--text)',
                      }}
                      onClick={() => setOwnerId('null')}
                    >
                      {ranchName}
                    </button>
                    {owners.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        className="text-left px-3 py-2.5 rounded-lg transition-all"
                        style={{
                          border:     `1.5px solid ${ownerId === o.id ? 'var(--accent)' : 'var(--border)'}`,
                          background: ownerId === o.id ? 'var(--accent-soft)' : 'var(--surface-1)',
                          color:      ownerId === o.id ? 'var(--accent)' : 'var(--text)',
                        }}
                        onClick={() => setOwnerId(o.id)}
                      >
                        {ownerDisplay(o)}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {/* Animal selector for animal_specific */}
              {expenseType === 'animal_specific' && (
                <Field label="Animal" required>
                  <Input
                    placeholder="Search by tag or name…"
                    value={animalSearch}
                    onChange={e => setAnimalSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {filteredAnimals.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        className="text-left px-3 py-2.5 rounded-lg transition-all"
                        style={{
                          border:     `1.5px solid ${animalId === a.id ? 'var(--accent)' : 'var(--border)'}`,
                          background: animalId === a.id ? 'var(--accent-soft)' : 'var(--surface-1)',
                          color:      animalId === a.id ? 'var(--accent)' : 'var(--text)',
                        }}
                        onClick={() => setAnimalId(a.id)}
                      >
                        <span className="font-mono font-semibold">#{a.tag_number}</span>
                        {a.name && <span className="ml-2 type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                      </button>
                    ))}
                    {filteredAnimals.length === 0 && (
                      <p className="type-helper px-2" style={{ color: 'var(--text-muted)' }}>No animals found</p>
                    )}
                  </div>
                </Field>
              )}
            </>
          )}

          {/* ── STEP 3: Expense details ───────────────────────────────────── */}
          {step === 3 && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>STEP 3 — DETAILS</p>

              {/* Semen Straws: qty + cost/straw */}
              {isSemenStraws ? (
                <>
                  <Field label="Bull / Sire">
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Bull name or NAAB code"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Straws used" required>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        placeholder="e.g. 8"
                      />
                    </Field>
                    <Field label="Cost per straw ($)" required>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitCost}
                        onChange={e => setUnitCost(e.target.value)}
                        placeholder="0.00"
                      />
                    </Field>
                  </div>
                  {quantity && unitCost && (
                    <ContextBanner tone="info">
                      Total: <strong>{fmt(parseFloat(quantity) * parseFloat(unitCost))}</strong>
                    </ContextBanner>
                  )}
                </>
              ) : isWorkingAnimals ? (
                <>
                  <Field label="Services performed">
                    <div className="flex flex-col gap-2 mt-1">
                      {WORKING_ITEMS.map(item => (
                        <label
                          key={item}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                          style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}
                        >
                          <input
                            type="checkbox"
                            checked={workingItems.includes(item)}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...workingItems, item]
                                : workingItems.filter(i => i !== item)
                              setWorkingItems(next)
                              const parts = next.filter(i => i !== 'Other')
                              if (next.includes('Other')) parts.push(otherDetail || 'Other')
                              setDescription(next.length ? 'Working Animals — ' + parts.join(', ') : '')
                            }}
                          />
                          <span className="type-label" style={{ color: 'var(--text)' }}>{item}</span>
                        </label>
                      ))}
                      {workingItems.includes('Other') && (
                        <Input
                          placeholder="Describe…"
                          value={otherDetail}
                          onChange={e => {
                            setOtherDetail(e.target.value)
                            const parts = workingItems.filter(i => i !== 'Other')
                            parts.push(e.target.value || 'Other')
                            setDescription('Working Animals — ' + parts.join(', '))
                          }}
                        />
                      )}
                    </div>
                  </Field>
                  <Field label="Total amount ($)" required>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalAmount}
                      onChange={e => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label={descriptionRequired ? 'Description *' : 'Description'}
                    helper={descriptionRequired ? undefined : 'Optional — pre-filled from category'}
                  >
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={descriptionRequired
                        ? 'e.g. Gather and load out for lease move'
                        : 'Optional notes'}
                      style={descriptionRequired && !description.trim()
                        ? { border: '1.5px solid var(--warning-border, #f59e0b)' }
                        : undefined}
                    />
                    {descriptionRequired && (
                      <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                        Required for this category
                      </p>
                    )}
                  </Field>
                  <Field label="Total amount ($)" required>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalAmount}
                      onChange={e => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                  {showQtyField && (
                    <Field label={isAITech ? "Cows AI'd" : 'Animals checked'}>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        placeholder="0"
                      />
                      <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                        Full amount billed to selected owner
                      </p>
                    </Field>
                  )}
                </>
              )}

              {calcType === 'one_time' ? (
                <Field label="Date of Event *">
                  <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                  <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                    Cost split equally among animals present on this date
                  </p>
                </Field>
              ) : (
                <Field label="Expense Period *">
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} placeholder="Start" />
                    <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} placeholder="End" />
                  </div>
                  <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                    Cost split pro-rated by days each animal was present during this period
                  </p>
                </Field>
              )}

              {expenseType === 'shared' && (
                <div
                  className="flex items-start justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="type-label" style={{ color: 'var(--text)' }}>Include calves in split</p>
                    <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Enable for wormer, ear tags, branding — expenses that apply to calves too
                    </p>
                  </div>
                  <Toggle checked={includeCalves} onChange={setIncludeCalves} />
                </div>
              )}

              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes…"
                />
              </Field>
            </>
          )}

          {/* ── STEP 4: Preview ───────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>STEP 4 — PREVIEW</p>

              {expenseType === 'shared' && (() => {
                const amt = parseFloat(computedTotal) || 0
                const rows = aumData?.by_owner ?? []
                return (
                  <div className="flex flex-col gap-3">
                    <ContextBanner tone="neutral">
                      {calcType === 'one_time'
                        ? `Split equally among animals present on ${expenseDate}`
                        : `Split pro-rated by days present from ${periodStart} to ${periodEnd}`}
                    </ContextBanner>
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <div
                        className="px-4 py-2 type-helper font-semibold"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                      >
                        {categoryName} — {fmt(amt)}
                      </div>
                      {rows.map((row, i) => {
                        const share = Math.round(amt * (row.percent_of_herd / 100) * 100) / 100
                        return (
                          <div
                            key={row.owner_id ?? 'unassigned'}
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined }}
                          >
                            <div>
                              <p className="type-data-sm font-medium" style={{ color: 'var(--text)' }}>{row.owner_name}</p>
                              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                                {row.billable} head · {row.percent_of_herd}%
                              </p>
                            </div>
                            <span className="font-bold" style={{ color: 'var(--gold-fg)' }}>{fmt(share)}</span>
                          </div>
                        )
                      })}
                      {rows.length === 0 && (
                        <div className="px-4 py-3">
                          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>No herd breakdown available</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {expenseType === 'owner_specific' && (
                <ContextBanner tone="info">
                  Full amount billed to <strong>{selectedOwner ? ownerDisplay(selectedOwner) : '—'}</strong>:{' '}
                  <strong>{fmt(parseFloat(computedTotal) || 0)}</strong>
                </ContextBanner>
              )}

              {expenseType === 'animal_specific' && (
                <ContextBanner tone="gold">
                  Full amount billed for animal{' '}
                  <strong>#{selectedAnimal?.tag_number ?? '—'}</strong>:{' '}
                  <strong>{fmt(parseFloat(computedTotal) || 0)}</strong>
                </ContextBanner>
              )}
            </>
          )}

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {step > 1 ? (
            <Button type="button" intent="ghost" size="sm" onClick={() => setStep(s => (s - 1) as 1|2|3|4)}>
              BACK
            </Button>
          ) : (
            <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          )}

          {step < 4 ? (
            <Button
              type="button"
              intent="primary"
              size="sm"
              className="flex-1"
              disabled={
                (step === 2 && !categoryId) ||
                (step === 2 && expenseType === 'owner_specific' && !ownerId) ||
                (step === 2 && expenseType === 'animal_specific' && !animalId)
              }
              onClick={() => {
                setError('')
                if (step === 2 && !categoryId) { setError('Select a category'); return }
                if (step === 2 && expenseType === 'owner_specific' && !ownerId) { setError('Select an owner'); return }
                if (step === 2 && expenseType === 'animal_specific' && !animalId) { setError('Select an animal'); return }
                if (step === 3 && descriptionRequired && !description.trim()) {
                  setError('Description is required for this expense type')
                  return
                }
                setStep(s => (s + 1) as 2|3|4)
              }}
            >
              NEXT
            </Button>
          ) : (
            <Button
              type="button"
              intent="primary"
              size="sm"
              loading={saving}
              className="flex-1"
              onClick={handleSave}
            >
              {mode === 'edit' ? 'SAVE CHANGES' : 'SAVE EXPENSE'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
