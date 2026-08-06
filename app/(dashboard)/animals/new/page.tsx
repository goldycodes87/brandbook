'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Upload, ChevronLeft } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { BreedSelector, type BreedEntry } from '@/components/animals/BreedSelector'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

// ── Ear tag color picker ──────────────────────────────────────────────────────

const EAR_TAG_COLORS = [
  { name: 'Yellow',  hex: '#F5C518' },
  { name: 'Orange',  hex: '#F97316' },
  { name: 'White',   hex: '#F3F4F6' },
  { name: 'Green',   hex: '#22C55E' },
  { name: 'Blue',    hex: '#3B82F6' },
  { name: 'Red',     hex: '#EF4444' },
  { name: 'Pink',    hex: '#EC4899' },
  { name: 'Purple',  hex: '#A855F7' },
  { name: 'Silver',  hex: '#9CA3AF' },
  { name: 'Black',   hex: '#1F2937' },
]

function EarTagColorPicker({ value, onChange, invalid }: { value: string; onChange: (c: string) => void; invalid?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap gap-3 mt-1">
        {EAR_TAG_COLORS.map(c => (
          <button
            key={c.name}
            type="button"
            title={c.name}
            onClick={() => onChange(c.name)}
            className="relative w-10 h-10 rounded-full transition-transform duration-100 active:scale-90"
            style={{
              backgroundColor: c.hex,
              border: value?.toLowerCase() === c.name.toLowerCase() ? '3px solid var(--accent)' : '2px solid var(--border)',
              boxShadow: value?.toLowerCase() === c.name.toLowerCase() ? '0 0 0 2px var(--accent)' : undefined,
            }}
          >
            {value?.toLowerCase() === c.name.toLowerCase() && (
              <Check
                size={16}
                className="absolute inset-0 m-auto"
                style={{ color: c.name === 'White' || c.name === 'Yellow' || c.name === 'Silver' ? '#000' : '#fff' }}
              />
            )}
          </button>
        ))}
      </div>
      {invalid && !value && (
        <p className="type-helper mt-1" style={{ color: 'var(--danger-fg)' }}>Ear tag color is required</p>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function toNum(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toUuid(v: string | undefined | null): string | null {
  return v && v.trim() !== '' ? v : null
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PairCalfSex = 'heifer_calf' | 'bull_calf' | 'calf'

function blankPairCalf() {
  return { tag_number: '', calf_sex: 'heifer_calf' as PairCalfSex, ear_tag_color: '', dob: '', dob_estimated: true, birth_weight_lbs: '' }
}

interface GrazingOwner {
  id: string; name: string; profile_id: string | null
  company_name?: string | null; owner_name?: string | null
  default_ear_tag_color?: string | null; default_breed?: string | null
}

interface RanchDefaults { default_ear_tag_color?: string; default_breed?: string }

type StepKey = 'source' | 'id' | 'age' | 'breed' | 'details' | 'pair_calf' | 'photo' | 'repro' | 'review'

const STEP_TITLES: Record<StepKey, string> = {
  source:   'Where did this animal come from?',
  id:       'Identify the animal',
  age:      'How old is it?',
  breed:    'What breed?',
  details:  'Additional details',
  pair_calf:'Pair calf info',
  photo:    'Add a photo',
  repro:    'Reproductive status at arrival',
  review:   'Review & Save',
}

// ── AI cost disclosure (collapsed by default) ─────────────────────────────────

function AiCostDisclosure({ aiCost, setAiCost, semenCost, setSemenCost }: {
  aiCost: string; setAiCost: (v: string) => void
  semenCost: string; setSemenCost: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--surface-2)' }}
      >
        <div>
          <span className="type-field-label">Advanced — historical cost (optional)</span>
          {!open && (aiCost || semenCost) && (
            <span className="type-helper ml-2" style={{ color: 'var(--accent)' }}>values entered</span>
          )}
        </div>
        <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 flex flex-col gap-4" style={{ backgroundColor: 'var(--surface-1)' }}>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            AI cost normally lives on the dam&apos;s breeding record (straw + cow). Only enter here when
            backfilling an animal that has no breeding history.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="AI tech fee ($)">
              <Input type="number" step="0.01" value={aiCost} onChange={e => setAiCost(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Semen cost ($)">
              <Input type="number" step="0.01" value={semenCost} onChange={e => setSemenCost(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Big option button ─────────────────────────────────────────────────────────

function BigBtn({ selected, onClick, emoji, label, sub }: {
  selected: boolean; onClick: () => void
  emoji?: string; label: string; sub?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-[var(--radius-lg)] p-4 text-left transition-all w-full relative"
      style={{
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        backgroundColor: selected ? 'color-mix(in srgb, var(--accent) 8%, var(--surface-1))' : 'var(--surface-1)',
      }}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent)', color: '#fff', fontSize: '11px' }}>
          ✓
        </div>
      )}
      {emoji && <span style={{ fontSize: '22px' }}>{emoji}</span>}
      <span className="type-section-label" style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}>{label}</span>
      {sub && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewAnimalPage() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState<StepKey>('source')

  // Source
  const [source, setSource] = useState<'purchased' | 'pair' | 'home_raised' | null>(null)

  // ID
  const [sex, setSex] = useState('')
  const [tagNumber, setTagNumber] = useState('')
  const [tagColor, setTagColor] = useState('')
  const [animalName, setAnimalName] = useState('')
  const [ownerId, setOwnerId] = useState<string | null>(null)

  // Age
  const [dob, setDob] = useState('')
  const [dobEstimated, setDobEstimated] = useState(false)
  const [approximateAge, setApproximateAge] = useState('')

  // Breed
  const [breeds, setBreeds] = useState<BreedEntry[]>([])
  const [breedError, setBreedError] = useState('')

  // Purchased details
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [vendor, setVendor] = useState('')
  const [brandInspectionUrl, setBrandInspectionUrl] = useState<string | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  // Home-raised details
  const [birthWeightLbs, setBirthWeightLbs] = useState('')
  const [birthWeightEstimated, setBirthWeightEstimated] = useState(false)
  const [conceptionMethod, setConceptionMethod] = useState<'natural' | 'ai' | 'embryo'>('natural')
  const [aiCost, setAiCost] = useState('')
  const [semenCost, setSemenCost] = useState('')
  const [embryoCost, setEmbryoCost] = useState('')
  const [implantFee, setImplantFee] = useState('')
  const [damId, setDamId] = useState('')
  const [sireId, setSireId] = useState('')

  // Pair calf
  const [pairCalf, setPairCalf] = useState(blankPairCalf())

  // Photo
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const pendingIdRef = useRef<string | null>(null)

  // Repro at intake
  const [arrivedBred, setArrivedBred] = useState<'open' | 'bred'>('open')
  const [breedDate, setBreedDate] = useState('')
  const [breedMethod, setBreedMethod] = useState<'natural' | 'ai'>('natural')
  const [reproSireName, setReproSireName] = useState('')
  const [expectedCalving, setExpectedCalving] = useState('')
  const [calvingDateEdited, setCalvingDateEdited] = useState(false)
  const [pregConfirmed, setPregConfirmed] = useState(false)

  // UI
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [savedAnimalId, setSavedAnimalId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Owners + ranch defaults
  const [owners, setOwners] = useState<GrazingOwner[]>([])
  const [ranchDefaults, setRanchDefaults] = useState<RanchDefaults>({})
  const [defaultsApplied, setDefaultsApplied] = useState<string | null>(null)

  useEffect(() => {
    apiGet('/api/grazing-owners').then(r => r.json()).then(d => {
      setOwners(Array.isArray(d.data) ? d.data : [])
    }).catch(() => {})
    apiGet('/api/settings/ranch').then(r => r.json()).then(d => {
      const s = d.data ?? d
      setRanchDefaults({ default_ear_tag_color: s.default_ear_tag_color || undefined, default_breed: s.default_breed || undefined })
      if (s.default_ear_tag_color) setTagColor(s.default_ear_tag_color)
    }).catch(() => {})
  }, [])

  // Auto-calc expected calving when breed date changes
  useEffect(() => {
    if (!calvingDateEdited && breedDate) {
      setExpectedCalving(addDays(breedDate, 283))
    }
  }, [breedDate, calvingDateEdited])

  // Clear defaults-applied banner
  useEffect(() => {
    if (!defaultsApplied) return
    const t = setTimeout(() => setDefaultsApplied(null), 3000)
    return () => clearTimeout(t)
  }, [defaultsApplied])

  // Steps depend on source + sex
  const steps = useMemo<StepKey[]>(() => {
    if (!source) return ['source']
    const s: StepKey[] = ['source', 'id', 'age', 'breed', 'details']
    if (source === 'pair') s.push('pair_calf')
    s.push('photo')
    if (sex === 'cow' || sex === 'heifer') s.push('repro')
    s.push('review')
    return s
  }, [source, sex])

  const stepIdx = steps.indexOf(currentStep)

  const handleOwnerChange = (newId: string | null) => {
    setOwnerId(newId)
    if (!newId) {
      if (ranchDefaults.default_ear_tag_color) setTagColor(ranchDefaults.default_ear_tag_color)
      if (ranchDefaults.default_breed && breeds.length === 0) setBreeds([{ breed: ranchDefaults.default_breed, pct: 100 }])
      setDefaultsApplied(null)
      return
    }
    const owner = owners.find(o => o.id === newId)
    if (!owner) return
    if (owner.default_ear_tag_color) setTagColor(owner.default_ear_tag_color)
    else if (ranchDefaults.default_ear_tag_color) setTagColor(ranchDefaults.default_ear_tag_color)
    if (owner.default_breed && breeds.length === 0) setBreeds([{ breed: owner.default_breed, pct: 100 }])
    setDefaultsApplied(owner.company_name || owner.owner_name || owner.name)
  }

  const canProceed = (step: StepKey): boolean => {
    switch (step) {
      case 'source':   return source !== null
      case 'id':       return tagNumber.trim() !== '' && tagColor !== '' && sex !== ''
      case 'pair_calf': return pairCalf.tag_number.trim() !== ''
      case 'repro':    return arrivedBred === 'open' || breedDate !== ''
      default: return true
    }
  }

  const goNext = () => {
    setSubmitted(true)
    if (!canProceed(currentStep)) return
    setSubmitted(false)
    const next = steps[stepIdx + 1]
    if (next) setCurrentStep(next)
  }

  const goBack = () => {
    setSubmitted(false)
    const prev = steps[stepIdx - 1]
    if (prev) setCurrentStep(prev)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      if (!pendingIdRef.current) {
        const res = await apiPost('/api/animals', {
          tag_number: tagNumber || `DRAFT-${Date.now()}`,
          sex: sex || 'calf',
          ear_tag_color: tagColor || 'Yellow',
          status: 'active',
        })
        if (!res.ok) return
        const d = await res.json()
        pendingIdRef.current = d.data?.id ?? d.id
      }
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiPost(`/api/animals/${pendingIdRef.current}/photos`, fd)
      if (res.ok) {
        const d = await res.json()
        setPhotoUrls(d.photos ?? [])
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleBrandInspectionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    try { setBrandInspectionUrl(URL.createObjectURL(file)) }
    finally { setUploadingDoc(false) }
  }

  const handleSave = async () => {
    setSubmitted(true)
    if (!tagNumber.trim() || !tagColor || !sex) { setCurrentStep('id'); return }
    if (breeds.length > 0) {
      const total = breeds.reduce((s, b) => s + (b.pct || 0), 0)
      if (total !== 100) { setBreedError('Breed percentages must total 100%'); setCurrentStep('breed'); return }
    }
    setBreedError('')
    setSaving(true)
    setError('')
    try {
      const origin = source === 'home_raised' ? 'home_raised' : 'purchased'
      const isPurchased = source !== 'home_raised'

      const payload: Record<string, unknown> = {
        tag_number:          tagNumber.trim(),
        ear_tag_color:       tagColor,
        sex,
        name:                animalName || null,
        owner_id:            toUuid(ownerId),
        dob:                 dob || null,
        dob_estimated:       dobEstimated,
        approximate_age:     approximateAge || null,
        breeds:              breeds.length > 0 ? breeds : null,
        photos:              photoUrls,
        status:              'active',
        origin,
        purchase_date:       isPurchased ? (purchaseDate || null) : null,
        purchase_price:      isPurchased ? toNum(purchasePrice) : null,
        vendor:              isPurchased ? (vendor || null) : null,
        purchased_as_pair:   source === 'pair',
        birth_weight_lbs:    !isPurchased ? toNum(birthWeightLbs) : null,
        birth_weight_estimated: !isPurchased ? birthWeightEstimated : null,
        conception_method:   !isPurchased ? conceptionMethod : null,
        ai_cost:             !isPurchased ? toNum(aiCost) : null,
        semen_cost:          !isPurchased ? toNum(semenCost) : null,
        embryo_cost:         !isPurchased ? toNum(embryoCost) : null,
        implant_fee:         !isPurchased ? toNum(implantFee) : null,
        dam_id:              !isPurchased ? toUuid(damId) : null,
        sire_id:             !isPurchased ? toUuid(sireId) : null,
      }

      if (source === 'pair' && pairCalf.tag_number.trim()) {
        payload.calf_data = {
          tag_number:       pairCalf.tag_number.trim(),
          sex:              'calf',
          calf_sex:         pairCalf.calf_sex === 'calf' ? null : pairCalf.calf_sex,
          ear_tag_color:    pairCalf.ear_tag_color || tagColor || null,
          dob:              pairCalf.dob || null,
          dob_estimated:    pairCalf.dob_estimated,
          birth_weight_lbs: toNum(pairCalf.birth_weight_lbs),
          status:           'active',
        }
      }

      let res: Response
      if (pendingIdRef.current) {
        res = await apiPatch(`/api/animals/${pendingIdRef.current}`, payload)
      } else {
        res = await apiPost('/api/animals', payload)
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }

      const animalId = data.data?.id ?? data.id
      if (!animalId) { setError('No animal ID returned'); return }

      // Repro at intake — use /api/reproduction directly (no straw deduction)
      if ((sex === 'cow' || sex === 'heifer') && arrivedBred === 'bred' && breedDate) {
        await apiPost('/api/reproduction', {
          animal_id:            animalId,
          event_type:           'bred',
          event_date:           breedDate,
          conception_method:    breedMethod,
          sire_name_text:       reproSireName || null,
          expected_calving_date: expectedCalving || addDays(breedDate, 283),
        })
        if (pregConfirmed) {
          await apiPost('/api/reproduction', {
            animal_id:            animalId,
            event_type:           'preg_check',
            event_date:           breedDate,
            preg_check_result:    'confirmed',
            expected_calving_date: expectedCalving || addDays(breedDate, 283),
          })
        }
      }

      setSavedAnimalId(animalId)
      setDone(true)
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    pendingIdRef.current = null
    setCurrentStep('source')
    setSource(null); setSex(''); setTagNumber('')
    setTagColor(ranchDefaults.default_ear_tag_color ?? ''); setAnimalName(''); setOwnerId(null)
    setDob(''); setDobEstimated(false); setApproximateAge('')
    setBreeds([]); setBreedError('')
    setPurchaseDate(''); setPurchasePrice(''); setVendor(''); setBrandInspectionUrl(null)
    setBirthWeightLbs(''); setBirthWeightEstimated(false); setConceptionMethod('natural')
    setAiCost(''); setSemenCost(''); setEmbryoCost(''); setImplantFee('')
    setDamId(''); setSireId('')
    setPairCalf(blankPairCalf())
    setPhotoUrls([])
    setArrivedBred('open'); setBreedDate(''); setBreedMethod('natural')
    setReproSireName(''); setExpectedCalving(''); setCalvingDateEdited(false); setPregConfirmed(false)
    setSaving(false); setError(''); setDone(false); setSavedAnimalId(null); setSubmitted(false)
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (done && savedAnimalId) {
    return (
      <PageContainer variant="narrow">
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--success-bg, #dcfce7)', color: 'var(--success-fg, #16a34a)' }}>
            <Check size={32} />
          </div>
          <div>
            <p className="type-panel-title mb-1">Animal saved!</p>
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
              {animalName ? `${animalName} (${tagNumber})` : `Tag #${tagNumber}`} has been added to your herd.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button intent="primary" onClick={() => router.push(`/animals/${savedAnimalId}`)}>
              VIEW ANIMAL
            </Button>
            <Button intent="ghost" onClick={resetForm}>
              ADD ANOTHER
            </Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  // ── Step content ────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {

      // ── 1. Source ───────────────────────────────────────────────────────────
      case 'source':
        return (
          <div className="flex flex-col gap-3">
            <BigBtn
              selected={source === 'purchased'}
              onClick={() => setSource('purchased')}
              emoji="🏷️"
              label="PURCHASED"
              sub="Bought from a ranch, sale barn, or seller"
            />
            <BigBtn
              selected={source === 'pair'}
              onClick={() => setSource('pair')}
              emoji="🐄🐂"
              label="PURCHASED AS A PAIR"
              sub="Came with a calf — create linked calf record"
            />
            <BigBtn
              selected={source === 'home_raised'}
              onClick={() => setSource('home_raised')}
              emoji="🏠"
              label="BORN HERE"
              sub="Born on our ranch, home-raised"
            />
          </div>
        )

      // ── 2. ID ───────────────────────────────────────────────────────────────
      case 'id':
        return (
          <div className="flex flex-col gap-6">
            {/* Sex */}
            <div>
              <p className="type-field-label mb-2">Sex <span style={{ color: 'var(--danger-fg)' }}>*</span></p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(['bull', 'cow', 'heifer', 'steer', 'calf'] as const).map(s => (
                  <BigBtn
                    key={s}
                    selected={sex === s}
                    onClick={() => setSex(s)}
                    label={s.toUpperCase()}
                  />
                ))}
              </div>
              {submitted && !sex && (
                <p className="type-helper mt-1" style={{ color: 'var(--danger-fg)' }}>Sex is required</p>
              )}
            </div>

            {/* Tag number */}
            <Field label="Ear Tag Number" required error={submitted && !tagNumber.trim() ? 'Ear tag number is required' : undefined}>
              <Input
                value={tagNumber}
                onChange={e => setTagNumber(e.target.value)}
                placeholder="e.g. 202"
                invalid={submitted && !tagNumber.trim()}
              />
            </Field>

            {/* Tag color */}
            <Field label="Ear Tag Color" required error={submitted && !tagColor ? 'Ear tag color is required' : undefined}>
              <EarTagColorPicker
                value={tagColor}
                onChange={setTagColor}
                invalid={submitted && !tagColor}
              />
            </Field>

            {/* Name */}
            <Field label="Name" helper="Optional nickname">
              <Input value={animalName} onChange={e => setAnimalName(e.target.value)} placeholder="Optional" />
            </Field>

            {/* Owner */}
            <Field label="Owner" helper="Leave blank if this is your animal">
              <Select
                value={ownerId || ''}
                onChange={e => handleOwnerChange(e.target.value || null)}
              >
                <option value="">My Animal (Ranch Default)</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.company_name
                      ? o.owner_name ? `${o.company_name} — ${o.owner_name}` : o.company_name
                      : (o.owner_name || o.name)}
                  </option>
                ))}
              </Select>
            </Field>
            {defaultsApplied && (
              <ContextBanner tone="info" eyebrow="DEFAULTS APPLIED">
                Applied {defaultsApplied}&apos;s cattle defaults. You can override any field.
              </ContextBanner>
            )}
          </div>
        )

      // ── 3. Age ──────────────────────────────────────────────────────────────
      case 'age':
        return (
          <div className="flex flex-col gap-5">
            <Toggle
              checked={dobEstimated}
              onChange={setDobEstimated}
              label="AGE IS APPROXIMATE"
              description="Use if exact date of birth is unknown"
            />

            {!dobEstimated ? (
              <Field label="Date of birth">
                <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
              </Field>
            ) : (
              <Field label="Approximate age" helper="e.g. '3 years old' or 'Spring 2023 calf'">
                <Input value={approximateAge} onChange={e => setApproximateAge(e.target.value)} placeholder="e.g. 3 years old" />
              </Field>
            )}
          </div>
        )

      // ── 4. Breed ────────────────────────────────────────────────────────────
      case 'breed':
        return (
          <div className="flex flex-col gap-4">
            <ContextBanner tone="info">
              Leave blank to skip. If entered, percentages must total 100%.
            </ContextBanner>
            <BreedSelector value={breeds} onChange={setBreeds} error={breedError || undefined} />
          </div>
        )

      // ── 5. Details ──────────────────────────────────────────────────────────
      case 'details':
        if (source === 'home_raised') {
          return (
            <div className="flex flex-col gap-5">
              {/* Birth weight */}
              <Field label="Birth weight (lbs)">
                <Input
                  type="number" step="0.1"
                  value={birthWeightLbs}
                  onChange={e => setBirthWeightLbs(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Toggle
                checked={birthWeightEstimated}
                onChange={setBirthWeightEstimated}
                label="BIRTH WEIGHT IS ESTIMATED"
              />

              {/* Conception method */}
              <div>
                <p className="type-field-label mb-2">Conception method</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'natural', label: 'Natural Service' },
                    { value: 'ai',      label: 'AI' },
                    { value: 'embryo',  label: 'Embryo (ET)' },
                  ] as const).map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setConceptionMethod(m.value)}
                      className="px-3 py-2.5 rounded-[var(--radius-md)] type-label font-bold uppercase tracking-wider text-center"
                      style={{
                        background: conceptionMethod === m.value ? 'var(--accent)' : 'var(--surface-2)',
                        color: conceptionMethod === m.value ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${conceptionMethod === m.value ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ET: embryo + implant costs are calf-level costs */}
              {conceptionMethod === 'embryo' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Embryo cost ($)" helper="Cost of the embryo itself">
                    <Input type="number" step="0.01" value={embryoCost} onChange={e => setEmbryoCost(e.target.value)} placeholder="0.00" />
                  </Field>
                  <Field label="Implant fee ($)" helper="Vet / tech fee to transfer">
                    <Input type="number" step="0.01" value={implantFee} onChange={e => setImplantFee(e.target.value)} placeholder="0.00" />
                  </Field>
                </div>
              )}

              {/* Natural: no cost fields */}
              {conceptionMethod === 'natural' && (
                <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  Natural-service cost is carried by the herd bull — no additional cost tracked on this calf.
                </p>
              )}

              {/* AI: costs collapsed by default */}
              {conceptionMethod === 'ai' && (
                <AiCostDisclosure
                  aiCost={aiCost} setAiCost={setAiCost}
                  semenCost={semenCost} setSemenCost={setSemenCost}
                />
              )}

              {/* Dam / Sire */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Dam ID" helper="UUID of dam record (optional)">
                  <Input value={damId} onChange={e => setDamId(e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Sire ID" helper="UUID of sire record (optional)">
                  <Input value={sireId} onChange={e => setSireId(e.target.value)} placeholder="Optional" />
                </Field>
              </div>
            </div>
          )
        }

        // Purchased / pair
        return (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Purchase date">
                <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </Field>
              <Field label="Purchase price ($)">
                <Input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Vendor / Source">
                <Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Ranch name, sale barn…" />
              </Field>
            </div>

            {/* Brand inspection */}
            <Field label="Brand Inspection" helper="Upload photo or scan of inspection paperwork">
              {brandInspectionUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brandInspectionUrl} alt="Brand inspection" className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    className="type-helper"
                    style={{ color: 'var(--danger-fg)' }}
                    onClick={() => setBrandInspectionUrl(null)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-[var(--radius-md)] transition-colors duration-150 type-button"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Upload size={15} />
                  {uploadingDoc ? 'Uploading…' : 'Upload document'}
                  <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={handleBrandInspectionUpload} disabled={uploadingDoc} />
                </label>
              )}
            </Field>
          </div>
        )

      // ── 6. Pair calf ─────────────────────────────────────────────────────────
      case 'pair_calf':
        return (
          <div className="flex flex-col gap-5">
            <ContextBanner tone="info">
              Calf will be linked to this cow as dam. Owner transfers automatically.
            </ContextBanner>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Calf tag number" required error={submitted && !pairCalf.tag_number.trim() ? 'Tag number required' : undefined}>
                <Input
                  value={pairCalf.tag_number}
                  onChange={e => setPairCalf(p => ({ ...p, tag_number: e.target.value }))}
                  placeholder="e.g. 2501"
                  invalid={submitted && !pairCalf.tag_number.trim()}
                />
              </Field>
              <Field label="Calf sex">
                <SegmentedControl
                  value={pairCalf.calf_sex}
                  onChange={v => setPairCalf(p => ({ ...p, calf_sex: v as PairCalfSex }))}
                  items={[
                    { value: 'heifer_calf', label: 'HEIFER' },
                    { value: 'bull_calf',   label: 'BULL' },
                    { value: 'calf',        label: 'UNKNOWN' },
                  ]}
                  block size="sm"
                />
              </Field>
              <div>
                <Field label="Calf DOB">
                  <Input type="date" value={pairCalf.dob} onChange={e => setPairCalf(p => ({ ...p, dob: e.target.value }))} />
                </Field>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="pair_dob_est"
                    checked={pairCalf.dob_estimated}
                    onChange={e => setPairCalf(p => ({ ...p, dob_estimated: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="pair_dob_est" className="type-helper" style={{ color: 'var(--text-muted)' }}>DOB is estimated</label>
                </div>
              </div>
              <Field label="Calf birth weight (lbs)">
                <Input
                  type="number" step="0.1"
                  value={pairCalf.birth_weight_lbs}
                  onChange={e => setPairCalf(p => ({ ...p, birth_weight_lbs: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field label="Calf ear tag color">
              <EarTagColorPicker
                value={pairCalf.ear_tag_color || tagColor}
                onChange={v => setPairCalf(p => ({ ...p, ear_tag_color: v }))}
              />
            </Field>
          </div>
        )

      // ── 7. Photo ────────────────────────────────────────────────────────────
      case 'photo':
        return (
          <div className="flex flex-col gap-4">
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {photoUrls.map(url => (
                  <div key={url} className="relative w-24 h-24 rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="object-cover w-full h-full" />
                  </div>
                ))}
              </div>
            )}
            <label
              className="inline-flex items-center gap-2 cursor-pointer px-4 py-3 rounded-[var(--radius-md)] transition-colors duration-150 type-button"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', alignSelf: 'flex-start' }}
            >
              <Upload size={16} />
              {uploadingPhoto ? 'Uploading…' : photoUrls.length > 0 ? 'Add another photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Optional — you can add photos later from the animal record.
            </p>
          </div>
        )

      // ── 8. Repro ────────────────────────────────────────────────────────────
      case 'repro':
        return (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <BigBtn selected={arrivedBred === 'open'} onClick={() => setArrivedBred('open')} emoji="⬜" label="OPEN" sub="Not currently bred" />
              <BigBtn selected={arrivedBred === 'bred'} onClick={() => setArrivedBred('bred')} emoji="✅" label="BRED" sub="Arrived pregnant / recently bred" />
            </div>

            {arrivedBred === 'bred' && (
              <div className="flex flex-col gap-4 pt-2">
                <Field label="Breed date" required error={submitted && !breedDate ? 'Breed date required' : undefined}>
                  <Input
                    type="date"
                    value={breedDate}
                    onChange={e => setBreedDate(e.target.value)}
                    invalid={submitted && !breedDate}
                  />
                </Field>

                <div>
                  <p className="type-field-label mb-2">Method</p>
                  <SegmentedControl
                    value={breedMethod}
                    onChange={v => setBreedMethod(v as 'natural' | 'ai')}
                    items={[
                      { value: 'natural', label: 'NATURAL' },
                      { value: 'ai',      label: 'AI' },
                    ]}
                    block
                  />
                </div>

                <Field label="Sire name" helper="Optional — who was she bred to?">
                  <Input value={reproSireName} onChange={e => setReproSireName(e.target.value)} placeholder="Optional" />
                </Field>

                <Field label="Expected calving date" helper="Auto-calculated as breed date + 283 days">
                  <Input
                    type="date"
                    value={expectedCalving}
                    onChange={e => { setExpectedCalving(e.target.value); setCalvingDateEdited(true) }}
                  />
                </Field>

                <Toggle
                  checked={pregConfirmed}
                  onChange={setPregConfirmed}
                  label="PREGNANCY CONFIRMED"
                  description="Mark if preg check has already confirmed this breeding"
                />
              </div>
            )}
          </div>
        )

      // ── 9. Review ────────────────────────────────────────────────────────────
      case 'review': {
        const rows: [string, string][] = [
          ['Source',    source === 'home_raised' ? 'Born here' : source === 'pair' ? 'Purchased as pair' : 'Purchased'],
          ['Sex',       sex],
          ['Tag #',     tagNumber],
          ['Tag color', tagColor],
        ]
        if (animalName) rows.push(['Name', animalName])
        if (dob)        rows.push(['DOB', dob + (dobEstimated ? ' (estimated)' : '')])
        if (approximateAge) rows.push(['Age', approximateAge])
        if (breeds.length > 0) rows.push(['Breed', breeds.map(b => `${b.breed} ${b.pct}%`).join(', ')])
        if (source !== 'home_raised') {
          if (purchaseDate)  rows.push(['Purchase date', purchaseDate])
          if (purchasePrice) rows.push(['Purchase price', `$${purchasePrice}`])
          if (vendor)        rows.push(['Vendor', vendor])
        } else {
          if (birthWeightLbs) rows.push(['Birth weight', `${birthWeightLbs} lbs${birthWeightEstimated ? ' (est.)' : ''}`])
          rows.push(['Conception', conceptionMethod])
          if (damId)  rows.push(['Dam ID', damId])
          if (sireId) rows.push(['Sire ID', sireId])
        }
        if (source === 'pair') rows.push(['Pair calf tag', pairCalf.tag_number])
        if (photoUrls.length > 0) rows.push(['Photos', `${photoUrls.length} uploaded`])
        if (sex === 'cow' || sex === 'heifer') {
          rows.push(['Repro status', arrivedBred === 'bred' ? 'Bred' : 'Open'])
          if (arrivedBred === 'bred') {
            rows.push(['Breed date', breedDate])
            if (expectedCalving) rows.push(['Expected calving', expectedCalving])
            rows.push(['Preg confirmed', pregConfirmed ? 'Yes' : 'No'])
          }
        }

        return (
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-lg)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {rows.map(([label, value], i) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
                >
                  <span className="type-helper" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
                  <span className="type-data-sm text-right capitalize">{value}</span>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
                style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                {error}
              </p>
            )}

            <Button intent="primary" loading={saving} onClick={handleSave}>
              SAVE ANIMAL
            </Button>
          </div>
        )
      }
    }
  }

  // ── Progress indicator ──────────────────────────────────────────────────────

  const totalSteps = steps.length
  const pct = totalSteps > 1 ? Math.round((stepIdx / (totalSteps - 1)) * 100) : 100

  return (
    <PageContainer variant="narrow">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="type-helper uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Step {stepIdx + 1} of {totalSteps}
          </p>
        </div>
        <p className="type-panel-title">{STEP_TITLES[currentStep]}</p>

        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="mb-8">
        {renderStep()}
      </div>

      {/* Navigation footer */}
      {currentStep !== 'review' && (
        <div className="flex items-center gap-3">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 type-helper"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          <div className="ml-auto">
            <Button intent="primary" onClick={goNext}>
              {stepIdx === totalSteps - 2 ? 'REVIEW' : 'NEXT'}
            </Button>
          </div>
        </div>
      )}

      {currentStep === 'review' && stepIdx > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 type-helper mt-2"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}
    </PageContainer>
  )
}
