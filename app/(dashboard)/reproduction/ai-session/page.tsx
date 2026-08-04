'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'
import { Panel } from '@/components/ui/Panel'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/fetch'
import { deriveReproStatus, type ReproStatusResult } from '@/lib/repro-status'

// ── Types ────────────────────────────────────────────────────────────────────

interface SemenItem {
  id: string
  sire_name: string
  straw_count: number | null
  price_per_straw: number | null
  sire_library_id: string | null
  sire_library: {
    id: string
    bull_name: string
    breed: string | null
    epd_ced: number | null
    epd_bw: number | null
    epd_ww: number | null
    epd_yw: number | null
    naab_code: string | null
  } | null
}

interface AnimalRow {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  dob: string | null
  ear_tag_color: string | null
  owner_id: string | null
  breeding_eligible: boolean | null
  owner: { id: string; name: string } | null
  repro?: ReproStatusResult | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function currentQtr(): 1 | 2 | 3 | 4 { return Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4 }
function currentYr(): number { return new Date().getFullYear() % 100 }

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Main component (needs Suspense for useSearchParams) ──────────────────────

function AISessionInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Step state
  const [step, setStep] = useState(1)

  // Step 1
  const [sessionDate,   setSessionDate]   = useState(new Date().toISOString().slice(0, 10))
  const [techName,      setTechName]      = useState('')
  const [logProtocol,   setLogProtocol]   = useState(false)
  const [groupId]                          = useState(() => uuid())

  // Step 2
  const [inventory,     setInventory]     = useState<SemenItem[]>([])
  const [selectedInv,   setSelectedInv]   = useState<SemenItem | null>(null)
  const [invLoading,    setInvLoading]    = useState(false)

  // Step 3
  const [animals,       setAnimals]       = useState<AnimalRow[]>([])
  const [animalsLoading,setAnimalsLoading]= useState(false)
  const [selected,      setSelected]      = useState<Set<string>>(new Set())

  // Ranch settings
  const [aiTechFeePerCow,    setAiTechFeePerCow]    = useState(280)
  const [aiPregCheckDaysOut, setAiPregCheckDaysOut] = useState(45)

  // Step 5 save state
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState('')
  const [done,          setDone]          = useState(false)
  const [doneData,      setDoneData]      = useState<{ count: number; remainingStraws: number; pregCheckDue: string; calvingWindow: string } | null>(null)

  // Load semen inventory and ranch settings on mount
  useEffect(() => {
    const preselectSire = searchParams.get('sire')
    const preselectInv  = searchParams.get('inv')

    setInvLoading(true)
    apiGet('/api/genetics/tank').then(r => r.json()).then(d => {
      const items: SemenItem[] = (d.data ?? []).map((i: SemenItem) => i)
      setInventory(items)
      if (preselectInv) {
        const found = items.find(i => i.id === preselectInv)
        if (found) { setSelectedInv(found); setStep(2) }
      } else if (preselectSire) {
        const found = items.find(i => i.sire_library_id === preselectSire)
        if (found) { setSelectedInv(found); setStep(2) }
      }
    }).catch(() => {}).finally(() => setInvLoading(false))

    apiGet('/api/settings/ranch').then(r => r.json()).then(j => {
      const s = j.data ?? {}
      if (s.ai_tech_fee_per_cow    != null) setAiTechFeePerCow(parseFloat(s.ai_tech_fee_per_cow) || 280)
      if (s.ai_preg_check_days_out != null) setAiPregCheckDaysOut(parseInt(s.ai_preg_check_days_out, 10) || 45)
      if (s.default_ai_technician)          setTechName(prev => prev || s.default_ai_technician)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load animals for step 3
  const loadAnimals = useCallback(async () => {
    setAnimalsLoading(true)
    try {
      // Fetch cows + heifers
      const [cowRes, heiferRes] = await Promise.all([
        apiGet('/api/animals?sex=cow&status=active&limit=200').then(r => r.json()),
        apiGet('/api/animals?sex=heifer&status=active&limit=200').then(r => r.json()),
      ])
      const all: AnimalRow[] = [
        ...(cowRes.data ?? []),
        ...(heiferRes.data ?? []),
      ]

      if (!all.length) { setAnimals([]); return }

      // Fetch repro events for these animals in one batch
      const animalIds = all.map(a => a.id)
      const reproRes = await apiGet(
        `/api/reproduction?animal_ids=${animalIds.join(',')}&limit=500`
      ).then(r => r.json())

      // Group events by animal_id
      const eventsByAnimal: Record<string, typeof reproRes.data> = {}
      for (const ev of (reproRes.data ?? [])) {
        const aid = ev.animal?.id as string
        if (!aid) continue
        if (!eventsByAnimal[aid]) eventsByAnimal[aid] = []
        eventsByAnimal[aid].push(ev)
      }

      // Compute repro status per animal
      const withRepro = all.map((a: AnimalRow) => ({
        ...a,
        repro: deriveReproStatus(
          { sex: a.sex, dob: a.dob, breeding_eligible: a.breeding_eligible },
          (eventsByAnimal[a.id] ?? []).map((e: { id: string; event_type: string; event_date: string; preg_check_result?: string | null; sire_name_text?: string | null; sire_library?: { bull_name?: string | null } | null; sire_library_id?: string | null; semen_inventory_id?: string | null; expected_calving_date?: string | null }) => e),
        ),
      }))

      setAnimals(withRepro)
    } finally { setAnimalsLoading(false) }
  }, [])

  function toggleAnimal(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleOwnerGroup(ownerAnimals: AnimalRow[]) {
    const ids = ownerAnimals.map(a => a.id)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const selectedAnimals = animals.filter(a => selected.has(a.id))
  const strawsNeeded    = selectedAnimals.length
  const strawsAvailable = selectedInv?.straw_count ?? 0
  const notEnoughStraws = strawsNeeded > strawsAvailable

  const pricePerStraw = selectedInv?.price_per_straw ?? 0
  const techFeePerCow = aiTechFeePerCow
  const totalTechFee  = selectedAnimals.length * techFeePerCow
  const totalStrawCost= selectedAnimals.length * pricePerStraw
  const grandTotal    = totalTechFee + totalStrawCost

  const calvingDate   = sessionDate ? addDays(sessionDate, 283)                 : null
  const pregCheckDue  = sessionDate ? addDays(sessionDate, aiPregCheckDaysOut) : null
  const calvingWindow = sessionDate ? `${fmtDate(addDays(sessionDate, 273))} – ${fmtDate(addDays(sessionDate, 293))}` : ''

  // CIDR timeline dates
  const cidrInsert  = sessionDate ? addDays(sessionDate, -10) : null
  const cidrPull    = sessionDate ? addDays(sessionDate, -3)  : null

  async function handleSave() {
    if (!selectedInv || !sessionDate || !techName.trim() || selectedAnimals.length === 0) return
    setSaving(true); setSaveError('')

    const bullName = selectedInv.sire_library?.bull_name ?? selectedInv.sire_name
    const sireLibraryId = selectedInv.sire_library_id
    const qtr  = currentQtr()
    const yr   = currentYr()

    try {
      await Promise.all(selectedAnimals.map(async animal => {
        // If overriding an existing bred cycle, delete the old event first (cascade cleans up expenses + reminder)
        const oldEventId = animal.repro?.lastBred?.eventId ?? null
        if (oldEventId && animal.repro && !animal.repro.breedable) {
          await apiDelete(`/api/reproduction/${oldEventId}`)
          // Return straw for the overridden event if it had inventory
          const oldInvId = animal.repro.lastBred?.semenInventoryId
          if (oldInvId) {
            const tankRes = await apiGet('/api/genetics/tank').then(r => r.json())
            const oldStraw = (tankRes.data ?? []).find((s: SemenItem) => s.id === oldInvId)
            if (oldStraw) {
              await apiPatch('/api/genetics/tank', { id: oldInvId, straw_count: (oldStraw.straw_count ?? 0) + 1 })
            }
          }
        }

        // 1. Create reproduction event
        const reproRes = await apiPost('/api/reproduction', {
          animal_id:          animal.id,
          event_type:         'bred',
          event_date:         sessionDate,
          conception_method:  'ai',
          ai_technician:      techName,
          sire_library_id:    sireLibraryId,
          semen_inventory_id: selectedInv.id,
          protocol_group_id:  groupId,
          protocol_step:      'ai',
          expected_calving_date: calvingDate,
          ai_cost:            techFeePerCow,
          straw_cost:         pricePerStraw,
          notes:              `AI session — ${bullName}`,
        })
        const reproJson = await reproRes.json()
        const newEventId = reproJson.data?.id ?? null

        // 2. Create preg check reminder (linked to this breeding event)
        await apiPost('/api/reminders', {
          animal_id:             animal.id,
          reminder_type:         'preg_check',
          due_date:              pregCheckDue,
          title:                 `Preg check — ${animal.ear_tag_color ?? ''} ${animal.tag_number}`.trim(),
          protocol_group_id:     groupId,
          reproduction_event_id: newEventId,
        })

        // 3. Create expenses for owned animals (owner_id != null)
        if (animal.owner_id) {
          await Promise.all([
            apiPost('/api/expenses', {
              category_name:        'AI Technician Fee',
              expense_type:         'owner_specific',
              owner_id:             animal.owner_id,
              total_amount:         techFeePerCow,
              expense_date:         sessionDate,
              quarter:              qtr,
              year:                 yr,
              description:          `AI Tech Fee — ${bullName}`,
              is_lease_specific:    false,
              reproduction_event_id: newEventId,
            }),
            pricePerStraw > 0 && apiPost('/api/expenses', {
              category_name:        'Semen Straws',
              expense_type:         'owner_specific',
              owner_id:             animal.owner_id,
              total_amount:         pricePerStraw,
              expense_date:         sessionDate,
              quarter:              qtr,
              year:                 yr,
              description:          `${bullName} semen straw`,
              sire_library_id:      sireLibraryId,
              is_lease_specific:    false,
              reproduction_event_id: newEventId,
            }),
          ].filter(Boolean))
        }
      }))

      // 4. Deduct straws
      const newCount = strawsAvailable - strawsNeeded
      await apiPatch('/api/genetics/tank', { id: selectedInv.id, straw_count: Math.max(0, newCount) })

      // 5. If log protocol steps: create backdated events
      if (logProtocol && cidrInsert && cidrPull) {
        await Promise.all(selectedAnimals.flatMap(animal => [
          apiPost('/api/reproduction', {
            animal_id: animal.id, event_type: 'bred', event_date: cidrInsert,
            conception_method: 'ai', protocol_step: 'cidr_insert',
            protocol_group_id: groupId, notes: 'CIDR Insert + GnRH',
          }),
          apiPost('/api/reproduction', {
            animal_id: animal.id, event_type: 'bred', event_date: cidrPull,
            conception_method: 'ai', protocol_step: 'cidr_pull',
            protocol_group_id: groupId, notes: 'Pull CIDR + Lutalyse',
          }),
        ]))
      }

      setDoneData({
        count:           selectedAnimals.length,
        remainingStraws: Math.max(0, newCount),
        pregCheckDue:    pregCheckDue ? fmtDate(pregCheckDue) : '—',
        calvingWindow,
      })
      setDone(true)
    } catch {
      setSaveError('Save failed — please try again.')
    } finally { setSaving(false) }
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done && doneData) {
    return (
      <PageContainer variant="narrow">
        <PageHeader title="AI Session Complete" />
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-6 flex flex-col gap-3" style={{ background: 'var(--success-bg)', border: '2px solid var(--success-fg)' }}>
            <p className="text-xl font-bold" style={{ color: 'var(--success-fg)' }}>✓ AI Session Complete!</p>
            <p className="type-body" style={{ color: 'var(--text)' }}>{doneData.count} cows bred</p>
            <p className="type-body" style={{ color: 'var(--text)' }}>
              {strawsNeeded} straws used — <strong>{doneData.remainingStraws}</strong> remaining
            </p>
            <p className="type-body" style={{ color: 'var(--text)' }}>Preg checks due: <strong>{doneData.pregCheckDue}</strong></p>
            <p className="type-body" style={{ color: 'var(--text)' }}>Expected calving: <strong>{doneData.calvingWindow}</strong></p>
          </div>
          <div className="flex gap-3">
            <Button intent="primary" size="sm" onClick={() => router.push('/reproduction')}>VIEW REPRODUCTION</Button>
            <Button intent="secondary" size="sm" onClick={() => { setDone(false); setStep(1); setSelected(new Set()); setSelectedInv(null); setTechName(''); setSaveError('') }}>LOG ANOTHER SESSION</Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  // ── Step renderer ────────────────────────────────────────────────────────

  // Split into breedable vs not-breedable
  const breedableAnimals    = animals.filter(a => a.repro == null || a.repro.breedable)
  const notBreedableAnimals = animals.filter(a => a.repro != null && !a.repro.breedable)
  const [showNotEligible, setShowNotEligible] = useState(false)

  // Group breedable animals by owner
  const ownerMap: Record<string, { label: string; animals: AnimalRow[] }> = {}
  for (const a of breedableAnimals) {
    const key   = a.owner_id ?? 'mine'
    const label = a.owner?.name ?? 'My Cattle'
    if (!ownerMap[key]) ownerMap[key] = { label, animals: [] }
    ownerMap[key].animals.push(a)
  }
  const ownerGroups = Object.entries(ownerMap)

  // Animals being overridden (selected but not breedable)
  const overrideAnimals = selectedAnimals.filter(a => a.repro && !a.repro.breedable)

  return (
    <PageContainer variant="narrow">
      <PageHeader
        eyebrow="REPRODUCTION"
        title="Log AI Breeding Session"
        subtitle={`Step ${step} of 4`}
        actions={step > 1 ? <Button intent="ghost" size="sm" onClick={() => setStep(s => s - 1)}>← Back</Button> : undefined}
      />

      {/* ── STEP 1: Session Setup ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <Panel title="SESSION DETAILS">
            <div className="flex flex-col gap-4 pt-1">
              <Field label="Breeding Date" required helper="Date cows were bred (Day 8-10 of protocol)">
                <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
              </Field>
              <Field label="AI Technician" required>
                <Input value={techName} onChange={e => setTechName(e.target.value)} placeholder="Technician name" />
              </Field>
            </div>
          </Panel>

          {sessionDate && (
            <Panel title="CIDR PROTOCOL TIMELINE">
              <div className="flex flex-col gap-3 pt-1">
                {[
                  { label: 'Day 0 — CIDR Insert + GnRH', date: cidrInsert! },
                  { label: 'Day 7 — Pull CIDR + Lutalyse', date: cidrPull! },
                  { label: 'Day 8-10 — Breed (TODAY)', date: sessionDate, highlight: true },
                  { label: 'Day 45 — Preg Check Due', date: pregCheckDue! },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="type-helper" style={{ color: row.highlight ? 'var(--accent)' : 'var(--text-muted)', fontWeight: row.highlight ? 700 : 400 }}>{row.label}</span>
                    <span className="type-helper font-semibold" style={{ color: row.highlight ? 'var(--accent)' : 'var(--text)' }}>{fmtDate(row.date)}</span>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input type="checkbox" checked={logProtocol} onChange={e => setLogProtocol(e.target.checked)} className="rounded" />
                <span className="type-helper" style={{ color: 'var(--text)' }}>Log protocol steps (CIDR insert, pull) as backdated events</span>
              </label>
            </Panel>
          )}

          <Button intent="primary" size="sm"
            disabled={!sessionDate || !techName.trim()}
            onClick={() => setStep(2)}>
            NEXT: SELECT BULL →
          </Button>
        </div>
      )}

      {/* ── STEP 2: Bull Selection ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>SELECT BULL</p>

          {invLoading ? (
            <div className="flex flex-col gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : inventory.filter(i => (i.straw_count ?? 0) > 0).length === 0 ? (
            <ContextBanner tone="warning">No semen with available straws. Add semen in the Tank Inventory first.</ContextBanner>
          ) : (
            <div className="flex flex-col gap-3">
              {inventory.map(item => {
                const bullName = item.sire_library?.bull_name ?? item.sire_name
                const count    = item.straw_count ?? 0
                const isSelected = selectedInv?.id === item.id
                const sl = item.sire_library

                return (
                  <button key={item.id} type="button"
                    disabled={count === 0}
                    onClick={() => setSelectedInv(item)}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      border:     `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--accent-soft)' : 'var(--surface-1)',
                      opacity:    count === 0 ? 0.5 : 1,
                    }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold" style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}>{bullName}</span>
                      <span className="font-bold text-lg" style={{ color: count <= 2 ? '#c87a00' : 'var(--success-fg)' }}>{count} 🌾</span>
                    </div>
                    <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                      {sl?.breed ?? '—'}{item.price_per_straw ? ` | $${item.price_per_straw}/straw` : ''}
                    </p>
                    {sl && (sl.epd_bw != null || sl.epd_ww != null) && (
                      <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                        {sl.epd_ced != null && `CED:${sl.epd_ced} `}
                        {sl.epd_bw  != null && `BW:${sl.epd_bw} `}
                        {sl.epd_ww  != null && `WW:${sl.epd_ww} `}
                        {sl.epd_yw  != null && `YW:${sl.epd_yw}`}
                      </p>
                    )}
                    {count === 1 && <p className="type-helper mt-1" style={{ color: '#c87a00', fontWeight: 600 }}>⚠ Last straw — use carefully</p>}
                  </button>
                )
              })}
            </div>
          )}

          <Button intent="primary" size="sm"
            disabled={!selectedInv}
            onClick={() => { setStep(3); loadAnimals() }}>
            NEXT: SELECT ANIMALS →
          </Button>
        </div>
      )}

      {/* ── STEP 3: Select Animals ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>SELECT ANIMALS TO BREED</p>
            <span className="type-helper font-semibold" style={{ color: 'var(--text)' }}>{selected.size} selected</span>
          </div>

          {notEnoughStraws && (
            <ContextBanner tone="danger">
              Not enough straws! You need {strawsNeeded} but only have {strawsAvailable}.
            </ContextBanner>
          )}

          <div className="flex gap-3 type-helper" style={{ color: 'var(--text-muted)' }}>
            <span>Straws needed: <strong style={{ color: notEnoughStraws ? 'var(--danger-fg)' : 'var(--text)' }}>{strawsNeeded}</strong></span>
            <span>Available: <strong>{strawsAvailable}</strong></span>
          </div>

          {animalsLoading ? (
            <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : animals.length === 0 ? (
            <ContextBanner tone="info">No eligible cows or heifers found.</ContextBanner>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Breedable animals grouped by owner */}
              {breedableAnimals.length === 0 && notBreedableAnimals.length > 0 ? (
                <ContextBanner tone="info">All animals in this herd are currently not eligible for breeding.</ContextBanner>
              ) : (
                ownerGroups.map(([ownerId, group]) => {
                  const allSel = group.animals.every(a => selected.has(a.id))
                  return (
                    <div key={ownerId}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>{group.label.toUpperCase()}</p>
                        <button type="button" className="type-helper" style={{ color: 'var(--accent)' }}
                          onClick={() => toggleOwnerGroup(group.animals)}>
                          {allSel ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        {group.animals.map(a => {
                          const isSel = selected.has(a.id)
                          const ageDays = a.dob ? Math.floor((Date.now() - new Date(a.dob).getTime()) / 86400000) : null
                          const ageMo   = ageDays ? Math.floor(ageDays / 30) : null
                          return (
                            <button key={a.id} type="button"
                              onClick={() => toggleAnimal(a.id)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                              style={{
                                border:     `1.5px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                                background: isSel ? 'var(--accent-soft)' : 'var(--surface-1)',
                              }}>
                              <input type="checkbox" readOnly checked={isSel} className="rounded" style={{ accentColor: 'var(--accent)' }} />
                              <EarTagDot color={a.ear_tag_color} size="sm" />
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>#{a.tag_number}</span>
                                {a.name && <span className="ml-1 type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {ageMo && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{ageMo}mo</span>}
                                <Chip tone="neutral" size="sm">{a.sex === 'heifer' ? 'Heifer' : 'Cow'}</Chip>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}

              {/* Not eligible section — collapsed by default */}
              {notBreedableAnimals.length > 0 && (
                <div>
                  <button type="button"
                    onClick={() => setShowNotEligible(v => !v)}
                    className="flex items-center gap-2 mb-2 w-full text-left"
                    style={{ color: 'var(--text-muted)' }}>
                    <span className="type-section-label">{showNotEligible ? '▾' : '▸'} NOT ELIGIBLE ({notBreedableAnimals.length})</span>
                  </button>
                  {showNotEligible && (
                    <div className="flex flex-col gap-1">
                      <p className="type-helper mb-1" style={{ color: 'var(--text-muted)' }}>Select to override — previous breeding record will be deleted.</p>
                      {notBreedableAnimals.map(a => {
                        const isSel = selected.has(a.id)
                        return (
                          <button key={a.id} type="button"
                            onClick={() => toggleAnimal(a.id)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                            style={{
                              border:     `1.5px solid ${isSel ? '#f59e0b' : 'var(--border)'}`,
                              background: isSel ? 'rgba(245,158,11,0.08)' : 'var(--surface-1)',
                            }}>
                            <input type="checkbox" readOnly checked={isSel} className="rounded"
                              style={{ accentColor: '#f59e0b' }} />
                            <EarTagDot color={a.ear_tag_color} size="sm" />
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>#{a.tag_number}</span>
                              {a.name && <span className="ml-1 type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                            </div>
                            {a.repro?.blockReason && (
                              <span className="type-helper shrink-0" style={{ color: '#f59e0b', fontSize: '0.75rem' }}>{a.repro.blockReason}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button intent="primary" size="sm"
            disabled={selected.size === 0 || notEnoughStraws}
            onClick={() => setStep(4)}>
            NEXT: REVIEW →
          </Button>
        </div>
      )}

      {/* ── STEP 4: Review & Costs ──────────────────────────────────────── */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <Panel title="SESSION SUMMARY">
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex justify-between type-body">
                <span style={{ color: 'var(--text-muted)' }}>Animals</span>
                <strong>{selectedAnimals.length}</strong>
              </div>
              <div className="flex justify-between type-body">
                <span style={{ color: 'var(--text-muted)' }}>Bull</span>
                <strong>{selectedInv?.sire_library?.bull_name ?? selectedInv?.sire_name}</strong>
              </div>
              <div className="flex justify-between type-body">
                <span style={{ color: 'var(--text-muted)' }}>Date</span>
                <strong>{fmtDate(sessionDate)}</strong>
              </div>
              <div className="flex justify-between type-body">
                <span style={{ color: 'var(--text-muted)' }}>Technician</span>
                <strong>{techName}</strong>
              </div>
            </div>
          </Panel>

          <Panel title="COST BREAKDOWN">
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex justify-between type-body">
                <span style={{ color: 'var(--text-muted)' }}>AI Tech Fee ({selectedAnimals.length} × $280)</span>
                <strong>${totalTechFee.toLocaleString()}</strong>
              </div>
              {pricePerStraw > 0 && (
                <div className="flex justify-between type-body">
                  <span style={{ color: 'var(--text-muted)' }}>Straws ({selectedAnimals.length} × ${pricePerStraw})</span>
                  <strong>${totalStrawCost.toLocaleString()}</strong>
                </div>
              )}
              <div className="flex justify-between type-body font-bold" style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                <span>Session Total</span>
                <span style={{ color: 'var(--gold-fg)' }}>${grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </Panel>

          <ContextBanner tone="info">
            <strong>Preg check reminder</strong> will be set for <strong>{pregCheckDue ? fmtDate(pregCheckDue) : '—'}</strong>
          </ContextBanner>

          <ContextBanner tone="neutral">
            <strong>Expected calving window:</strong> {calvingWindow}
          </ContextBanner>

          {overrideAnimals.length > 0 && (
            <div className="rounded-lg px-4 py-3" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
              <p className="type-helper font-semibold" style={{ color: 'var(--warning-fg)', marginBottom: 4 }}>
                ⚠ {overrideAnimals.length} animal{overrideAnimals.length > 1 ? 's are' : ' is'} already bred — will be overridden
              </p>
              {overrideAnimals.map(a => (
                <p key={a.id} className="type-helper" style={{ color: 'var(--warning-fg)' }}>
                  #{a.tag_number} — {a.repro?.blockReason}
                </p>
              ))}
              <p className="type-helper mt-2" style={{ color: 'var(--warning-fg)', opacity: 0.8 }}>
                Previous breeding records and linked expenses will be deleted. Straws will be returned to inventory.
              </p>
            </div>
          )}

          {saveError && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>{saveError}</p>
          )}

          <Button intent="primary" size="sm" loading={saving} onClick={handleSave}>
            {overrideAnimals.length > 0
              ? `OVERRIDE & BREED ${selectedAnimals.length} COWS`
              : `START AI SESSION — BREED ${selectedAnimals.length} COWS`}
          </Button>
        </div>
      )}
    </PageContainer>
  )
}

export default function AISessionPage() {
  return (
    <Suspense fallback={
      <PageContainer variant="narrow">
        <div className="h-10 w-60 rounded animate-pulse mb-6" style={{ background: 'var(--surface-2)' }} />
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </PageContainer>
    }>
      <AISessionInner />
    </Suspense>
  )
}
