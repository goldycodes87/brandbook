'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost, apiPatch, apiGet } from '@/lib/fetch'

interface LeaseOption { id: string; property_name: string }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaseExpense {
  id: string
  lease_id: string | null
  is_lease_specific?: boolean | null
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

interface GrazingOwner { id: string; name: string; company_name: string | null; owner_name: string | null; is_self: boolean }
interface LeaseAnimal  { id: string; tag_number: string; name: string | null; ear_tag_color: string | null; sex: string | null; owner_id: string | null }

type ExpenseType = 'shared' | 'owner_specific' | 'animal_specific'

const TYPE_CONFIG: Record<ExpenseType, { emoji: string; label: string; sub: string }> = {
  shared:          { emoji: '🌾', label: 'SHARED',         sub: 'Split by herd %' },
  owner_specific:  { emoji: '👤', label: 'OWNER SPECIFIC', sub: 'One owner' },
  animal_specific: { emoji: '🐄', label: 'ANIMAL SPECIFIC', sub: 'Split across animals' },
}

type Scope = 'whole_herd' | 'lease_specific'

interface Props {
  isOpen: boolean
  onClose: () => void
  leaseId?: string
  leaseName?: string
  ranchName?: string
  onSuccess: () => void
  initialData?: LeaseExpense | null
  mode?: 'create' | 'edit'
  defaultScope?: Scope
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const categoryDefaults: Record<string, boolean> = {
  'Working Animals':       true,
  'AI Technician Fee':     false,
  'Semen Straws':          false,
  'Preg Check':            false,
  'Vet Bill':              false,
  'Medication':            false,
  'Veterinary Procedure':  false,
  'Labor':                 false,
  'Equipment Rental':      false,
  'Fence Repair':          false,
  'Pasture Treatment':     false,
}

// ─── Component ────────────────────────────────────────────────────────────────

function currentQtr() { const m = new Date().getMonth(); return Math.ceil((m + 1) / 3) as 1|2|3|4 }
function currentYr()  { return new Date().getFullYear() % 100 }

export function AddLeaseExpenseSheet({
  isOpen, onClose, leaseId, leaseName, ranchName = 'My Ranch', onSuccess, initialData, mode = 'create', defaultScope,
}: Props) {
  const [step,          setStep]         = useState<1 | 2 | 3 | 4>(1)
  const [expenseType,   setExpenseType]  = useState<ExpenseType>('shared')
  const [scope,         setScope]        = useState<Scope>(defaultScope ?? (leaseId ? 'lease_specific' : 'whole_herd'))
  const [expQtr,        setExpQtr]       = useState<1|2|3|4>(currentQtr())
  const [expYear,       setExpYear]      = useState<number>(currentYr())
  const [leases,        setLeases]       = useState<LeaseOption[]>([])
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null)
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
  const [animalIds,     setAnimalIds]    = useState<string[]>([])
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

    if (leaseId) {
      apiGet(`/api/leases/${leaseId}/animals`).then(r => r.json()).then(d => {
        setAnimals(d.data ?? [])
      }).catch(() => {})

      apiGet(`/api/leases/${leaseId}/aum`).then(r => r.json()).then(d => {
        if (!d.error) setAumData(d)
      }).catch(() => {})
    } else {
      // No lease: load all active animals for animal_specific, and leases for scope selector
      apiGet('/api/animals?status=active&limit=300').then(r => r.json()).then(d => {
        setAnimals(d.data ?? [])
      }).catch(() => {})

      apiGet('/api/leases').then(r => r.json()).then(d => {
        setLeases(d.data ?? [])
      }).catch(() => {})
    }

    // Populate from initialData when editing
    if (mode === 'edit' && initialData) {
      setExpenseType((initialData.expense_type as ExpenseType) || 'shared')
      setScope(initialData.is_lease_specific === false ? 'whole_herd' : 'lease_specific')
      setCategoryId(initialData.category_id)
      setCategoryName(initialData.category_name)
      setDescription(initialData.description ?? '')
      setExpenseDate(initialData.expense_date ?? todayStr())
      setTotalAmount(String(initialData.total_amount ?? ''))
      setQuantity(initialData.qty != null ? String(initialData.qty) : '')
      setUnitCost(initialData.unit_cost != null ? String(initialData.unit_cost) : '')
      setNotes(initialData.notes ?? '')
      setOwnerId(initialData.owner_id)
      setAnimalIds(initialData.animal_id ? [initialData.animal_id] : [])
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
      setScope(defaultScope ?? (leaseId ? 'lease_specific' : 'whole_herd'))
      setExpQtr(currentQtr())
      setExpYear(currentYr())
      setSelectedLeaseId(null)
      setCategoryId(null)
      setCategoryName('')
      setDescription('')
      setExpenseDate(todayStr())
      setTotalAmount('')
      setQuantity('')
      setUnitCost('')
      setNotes('')
      setOwnerId(null)
      setAnimalIds([])
      setAnimalSearch('')
      setIncludeCalves(false)
      setCalcType('period')
      setPeriodStart(qtrStartStr())
      setPeriodEnd(todayStr())
      setWorkingItems([])
      setOtherDetail('')
    }
    setError('')
  }, [isOpen, leaseId, mode, initialData, defaultScope])

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
    if (expenseType === 'animal_specific' && animalIds.length === 0) { setError('Select at least one animal'); return }
    if (descriptionRequired && !description.trim()) { setError('Description is required for this expense type'); return }

    const isWholeHerd = expenseType === 'shared' && scope === 'whole_herd'
    const effectiveLeaseId = leaseId || selectedLeaseId
    const usesGlobalExpensesRoute =
      isWholeHerd ||
      expenseType === 'owner_specific' ||
      expenseType === 'animal_specific'

    if (!usesGlobalExpensesRoute && !effectiveLeaseId) { setError('Select a lease for lease-specific expenses'); return }

    setSaving(true); setError('')
    try {
      // Multi-animal split: one row per animal, equal per-head, owner routed from animal record
      if (expenseType === 'animal_specific' && mode !== 'edit') {
        const selfOwner = owners.find(o => o.is_self) ?? null
        const N = animalIds.length
        const totalCents = Math.round(amt * 100)
        const perHeadCents = Math.floor(totalCents / N)
        for (let idx = 0; idx < N; idx++) {
          const aId = animalIds[idx]
          const animal = animals.find(a => a.id === aId)
          const routedOwnerId = animal?.owner_id ?? selfOwner?.id ?? null
          const shareCents = idx === N - 1 ? totalCents - perHeadCents * (N - 1) : perHeadCents
          const res = await apiPost('/api/expenses', {
            category_name:    categoryName,
            category_id:      categoryId,
            expense_type:     'animal_specific',
            description:      description.trim() || null,
            total_amount:     shareCents / 100,
            expense_date:     expenseDate || null,
            notes:            notes || null,
            owner_id:         routedOwnerId,
            animal_id:        aId,
            is_lease_specific: false,
          })
          const json = await res.json()
          if (!res.ok) { setError(json.error ?? 'Save failed'); return }
        }
        onSuccess(); onClose()
        return
      }

      // For whole-herd: auto-derive period from selected quarter
      let pStart = calcType === 'period' ? (periodStart || null) : null
      let pEnd   = calcType === 'period' ? (periodEnd   || null) : null
      if (isWholeHerd && calcType === 'period') {
        const yr = 2000 + expYear
        pStart = new Date(yr, (expQtr - 1) * 3, 1).toISOString().slice(0, 10)
        pEnd   = new Date(yr, expQtr * 3, 0).toISOString().slice(0, 10)
      }

      const payload: Record<string, unknown> = {
        category_name:    categoryName,
        category_id:      categoryId,
        expense_type:     expenseType,
        description:      description.trim() || null,
        total_amount:     amt,
        expense_date:     calcType === 'one_time' ? (expenseDate || null) : (pStart || null),
        period_start:     pStart,
        period_end:       pEnd,
        notes:            notes || null,
        owner_id:         expenseType === 'owner_specific'  ? (ownerId === 'null' ? null : ownerId)  : null,
        animal_id:        expenseType === 'animal_specific' ? (animalIds[0] ?? null) : null,
        qty:              quantity ? parseFloat(quantity) : null,
        unit_cost:        unitCost ? parseFloat(unitCost) : null,
        include_calves:   expenseType === 'shared' ? includeCalves : false,
        is_lease_specific: !usesGlobalExpensesRoute,
        quarter:          isWholeHerd ? expQtr : undefined,
        year:             isWholeHerd ? expYear : undefined,
      }

      let url: string
      if (mode === 'edit' && initialData) {
        url = usesGlobalExpensesRoute
          ? `/api/expenses/${initialData.id}`
          : `/api/leases/${effectiveLeaseId}/expenses/${initialData.id}`
      } else {
        url = usesGlobalExpensesRoute ? '/api/expenses' : `/api/leases/${effectiveLeaseId}/expenses`
      }

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
        style={{ background: 'var(--surface-0)', maxHeight: '92dvh', height: '92dvh', touchAction: 'pan-y' }}
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
        <div className="flex-1 px-5 pb-4 flex flex-col gap-4" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0, flex: '1 1 0' }}>

          {/* ── STEP 1: Expense type + scope ──────────────────────────────── */}
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

              {expenseType === 'shared' && (
                <>
                  <p className="type-section-label mt-1" style={{ color: 'var(--text-muted)' }}>EXPENSE SCOPE</p>
                  <div className="flex flex-col gap-2">
                    {([
                      { val: 'whole_herd' as Scope, emoji: '🌾', label: 'WHOLE HERD', sub: 'Split across all owners by herd % for the quarter (default)' },
                      { val: 'lease_specific' as Scope, emoji: '🏡', label: 'LEASE SPECIFIC', sub: 'Only split among animals on a specific lease' },
                    ]).map(({ val, emoji, label, sub }) => (
                      <button
                        key={val}
                        type="button"
                        className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                        style={{
                          border: `2px solid ${scope === val ? 'var(--accent)' : 'var(--border)'}`,
                          background: scope === val ? 'var(--accent-soft)' : 'var(--surface-1)',
                        }}
                        onClick={() => setScope(val)}
                      >
                        <span className="text-2xl mt-0.5">{emoji}</span>
                        <div>
                          <p className="type-label font-bold text-xs" style={{ color: scope === val ? 'var(--accent)' : 'var(--text)' }}>{label}</p>
                          <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {scope === 'whole_herd' && (
                    <>
                      <p className="type-section-label mt-1" style={{ color: 'var(--text-muted)' }}>WHICH QUARTER?</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          {([1,2,3,4] as const).map((q, i) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setExpQtr(q)}
                              className="px-3 py-1.5 text-xs font-semibold"
                              style={{
                                background: expQtr === q ? 'var(--accent)' : 'var(--surface-1)',
                                color:      expQtr === q ? 'white' : 'var(--text-muted)',
                                borderRight: i < 3 ? '1px solid var(--border)' : undefined,
                              }}
                            >Q{q}</button>
                          ))}
                        </div>
                        <select
                          value={expYear}
                          onChange={e => setExpYear(Number(e.target.value))}
                          className="text-sm rounded px-2 py-1.5"
                          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        >
                          {Array.from({ length: 4 }, (_, i) => currentYr() - i + 1).map(y => (
                            <option key={y} value={y}>{2000 + y}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {scope === 'lease_specific' && !leaseId && (
                    <Field label="Which lease?" required>
                      <div className="flex flex-col gap-1.5 mt-1">
                        {leases.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            className="text-left px-3 py-2.5 rounded-lg"
                            style={{
                              border:     `1.5px solid ${selectedLeaseId === l.id ? 'var(--accent)' : 'var(--border)'}`,
                              background: selectedLeaseId === l.id ? 'var(--accent-soft)' : 'var(--surface-1)',
                              color:      selectedLeaseId === l.id ? 'var(--accent)' : 'var(--text)',
                            }}
                            onClick={() => setSelectedLeaseId(l.id)}
                          >
                            {l.property_name}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}
                </>
              )}
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
                      setIncludeCalves(categoryDefaults[cat.name] ?? false)
                      if (cat.name === 'Working Animals') {
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

              {/* Animal selector for animal_specific — multi-select */}
              {expenseType === 'animal_specific' && (
                <Field label={`Animals (${animalIds.length} selected)`} required>
                  <Input
                    placeholder="Search by tag or name…"
                    value={animalSearch}
                    onChange={e => setAnimalSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                    {filteredAnimals.map(a => {
                      const checked = animalIds.includes(a.id)
                      return (
                        <label
                          key={a.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                          style={{
                            border:     `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                            background: checked ? 'var(--accent-soft)' : 'var(--surface-1)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              setAnimalIds(prev =>
                                e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id)
                              )
                            }}
                          />
                          <span className="font-mono font-semibold" style={{ color: checked ? 'var(--accent)' : 'var(--text)' }}>
                            #{a.tag_number}
                          </span>
                          {a.name && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                        </label>
                      )
                    })}
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
                const isWH = scope === 'whole_herd'
                const rows = aumData?.by_owner ?? []
                return (
                  <div className="flex flex-col gap-3">
                    {isWH ? (
                      <ContextBanner tone="info">
                        <strong>{fmt(amt)}</strong> will be split by herd % across all owners when Q{expQtr} {2000 + expYear} invoices are generated.
                      </ContextBanner>
                    ) : (
                      <>
                        <ContextBanner tone="neutral">
                          {calcType === 'one_time'
                            ? `Split equally among animals present on ${expenseDate}`
                            : `Split pro-rated by days present from ${periodStart} to ${periodEnd}`}
                        </ContextBanner>
                        {rows.length > 0 && (
                          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                            <div className="px-4 py-2 type-helper font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                              {categoryName} — {fmt(amt)}
                            </div>
                            {rows.map((row, i) => {
                              const share = Math.round(amt * (row.percent_of_herd / 100) * 100) / 100
                              return (
                                <div key={row.owner_id ?? 'unassigned'} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined }}>
                                  <div>
                                    <p className="type-data-sm font-medium" style={{ color: 'var(--text)' }}>{row.owner_name}</p>
                                    <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{row.billable} head · {row.percent_of_herd}%</p>
                                  </div>
                                  <span className="font-bold" style={{ color: 'var(--gold-fg)' }}>{fmt(share)}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {rows.length === 0 && (
                          <ContextBanner tone="neutral">No herd breakdown available for this lease</ContextBanner>
                        )}
                      </>
                    )}
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
                animalIds.length === 1 ? (
                  <ContextBanner tone="gold">
                    Full amount billed for animal{' '}
                    <strong>#{animals.find(a => a.id === animalIds[0])?.tag_number ?? '—'}</strong>:{' '}
                    <strong>{fmt(parseFloat(computedTotal) || 0)}</strong>
                  </ContextBanner>
                ) : (
                  <ContextBanner tone="gold">
                    <strong>{fmt(parseFloat(computedTotal) || 0)}</strong> split equally across{' '}
                    <strong>{animalIds.length} animals</strong>{' '}
                    ({fmt((parseFloat(computedTotal) || 0) / Math.max(animalIds.length, 1))}/head)
                  </ContextBanner>
                )
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
                (step === 1 && expenseType === 'shared' && scope === 'lease_specific' && !leaseId && !selectedLeaseId) ||
                (step === 2 && !categoryId) ||
                (step === 2 && expenseType === 'owner_specific' && !ownerId) ||
                (step === 2 && expenseType === 'animal_specific' && animalIds.length === 0)
              }
              onClick={() => {
                setError('')
                if (step === 1 && expenseType === 'shared' && scope === 'lease_specific' && !leaseId && !selectedLeaseId) { setError('Select a lease'); return }
                if (step === 2 && !categoryId) { setError('Select a category'); return }
                if (step === 2 && expenseType === 'owner_specific' && !ownerId) { setError('Select an owner'); return }
                if (step === 2 && expenseType === 'animal_specific' && animalIds.length === 0) { setError('Select at least one animal'); return }
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
