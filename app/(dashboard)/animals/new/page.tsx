'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mic, MicOff, Plus, Trash2, Upload, Check } from 'lucide-react'
import { useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ActionFooter } from '@/components/ui/ActionFooter'
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
      <div className="flex flex-wrap gap-2 mt-0.5">
        {EAR_TAG_COLORS.map(c => (
          <button
            key={c.name}
            type="button"
            title={c.name}
            onClick={() => onChange(c.name)}
            className="relative w-8 h-8 rounded-full transition-transform duration-100 active:scale-90"
            style={{
              backgroundColor: c.hex,
              border: value?.toLowerCase() === c.name.toLowerCase() ? '3px solid var(--accent)' : '2px solid var(--border)',
              boxShadow: value?.toLowerCase() === c.name.toLowerCase() ? '0 0 0 1px var(--accent)' : undefined,
            }}
          >
            {value?.toLowerCase() === c.name.toLowerCase() && (
              <Check
                size={14}
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

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  tag_number:          z.string().min(1, 'Ear tag number is required'),
  ear_tag_color:       z.string().min(1, 'Ear tag color is required'),
  sex:                 z.string().min(1, 'Sex is required'),
  name:                z.string().optional(),
  dob:                 z.string().optional(),
  dob_estimated:       z.boolean().optional(),
  approximate_age:     z.string().optional(),
  status:              z.string().optional(),
  birth_weight_lbs:    z.string().optional(),
  purchase_price:      z.string().optional(),
  purchase_date:       z.string().optional(),
  vendor:              z.string().optional(),
  dam_id:              z.string().optional(),
  sire_id:             z.string().optional(),
  owner_id:            z.string().optional(),
  notes:               z.string().optional(),
  registration_numbers: z.array(z.object({
    registry: z.string().min(1),
    number:   z.string().min(1),
  })).optional(),
})

type FormValues = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toUuid(v: string | undefined): string | null {
  return v && v.trim() !== '' ? v : null
}

// Convert every "" / undefined value to null before sending to Postgres
function sanitizePayload(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' || v === undefined ? null : v])
  )
}

type RecordingState = 'idle' | 'recording' | 'processing'

interface VoiceResult {
  transcript: string
  fields: Record<string, unknown>
}

// Field labels for the confirmation modal
const FIELD_LABELS: Record<string, string> = {
  tag_number:       'Ear Tag #',
  name:             'Name',
  sex:              'Sex',
  dob:              'Date of birth',
  birth_weight_lbs: 'Birth weight',
  purchase_price:   'Purchase price',
  purchase_date:    'Purchase date',
  vendor:           'Vendor',
  notes:            'Notes',
  breed:            'Breed',
  breed_percentage: 'Breed %',
}

interface GrazingOwner {
  id: string; name: string; profile_id: string | null
  company_name?: string | null
  owner_name?: string | null
  default_ear_tag_color?: string | null
  default_breed?: string | null
}

interface RanchDefaults { default_ear_tag_color?: string; default_breed?: string }

type PairCalfSex = 'heifer_calf' | 'bull_calf' | 'calf'

function blankPairCalf() {
  return {
    tag_number:       '',
    calf_sex:         'heifer_calf' as PairCalfSex,
    ear_tag_color:    '',
    dob:              '',
    dob_estimated:    true,
    birth_weight_lbs: '',
  }
}

export default function NewAnimalPage() {
  const router = useRouter()
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [owners, setOwners]                 = useState<GrazingOwner[]>([])
  const [ranchDefaults, setRanchDefaults]   = useState<RanchDefaults>({})
  const [recording, setRecording]           = useState<RecordingState>('idle')
  const [voiceResult, setVoiceResult]       = useState<VoiceResult | null>(null)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [photoUrls, setPhotoUrls]           = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [breeds, setBreeds]                 = useState<BreedEntry[]>([])
  const [breedError, setBreedError]         = useState('')
  const [defaultsApplied, setDefaultsApplied] = useState<string | null>(null)
  const [isPair, setIsPair]                 = useState(false)
  const [pairCalf, setPairCalf]             = useState(blankPairCalf())
  const mediaRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const pendingIdRef = useRef<string | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors }, control } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', registration_numbers: [] },
  })

  const earTagColor    = watch('ear_tag_color') ?? ''
  const dobEstimated   = watch('dob_estimated') ?? false

  useEffect(() => {
    apiGet('/api/grazing-owners').then(r => r.json()).then(d => { setOwners(Array.isArray(d.data) ? d.data : []) }).catch(() => {})
    apiGet('/api/settings/ranch').then(r => r.json()).then(d => {
      const s = d.data ?? d
      setRanchDefaults({ default_ear_tag_color: s.default_ear_tag_color || undefined, default_breed: s.default_breed || undefined })
      if (s.default_ear_tag_color) setValue('ear_tag_color', s.default_ear_tag_color)
    }).catch(() => {})
  }, [setValue])

  const handleOwnerChange = (ownerId: string | null) => {
    setValue('owner_id', ownerId || undefined)

    if (!ownerId) {
      if (ranchDefaults.default_ear_tag_color) setValue('ear_tag_color', ranchDefaults.default_ear_tag_color)
      if (ranchDefaults.default_breed && breeds.length === 0) {
        setBreeds([{ breed: ranchDefaults.default_breed, pct: 100 }])
      }
      setDefaultsApplied(null)
      return
    }

    const owner = owners.find(o => o.id === ownerId)
    if (!owner) return

    if (owner.default_ear_tag_color) {
      setValue('ear_tag_color', owner.default_ear_tag_color, { shouldDirty: true })
    } else if (ranchDefaults.default_ear_tag_color) {
      setValue('ear_tag_color', ranchDefaults.default_ear_tag_color, { shouldDirty: true })
    }

    if (owner.default_breed && breeds.length === 0) {
      setBreeds([{ breed: owner.default_breed, pct: 100 }])
    }

    setDefaultsApplied(owner.company_name || owner.owner_name || owner.name)
  }

  useEffect(() => {
    if (!defaultsApplied) return
    const t = setTimeout(() => setDefaultsApplied(null), 3000)
    return () => clearTimeout(t)
  }, [defaultsApplied])

  const { fields: regFields, append: addReg, remove: removeReg } = useFieldArray({
    control,
    name: 'registration_numbers',
  })

  // Apply voice-extracted fields to the form with dirty/validate flags so RHF re-renders inputs
  const applyVoiceFields = useCallback((fields: Record<string, unknown>) => {
    const opts = { shouldValidate: true, shouldDirty: true } as const

    const fieldMap: Record<string, keyof FormValues> = {
      tag_number:       'tag_number',
      name:             'name',
      sex:              'sex',
      dob:              'dob',
      birth_weight_lbs: 'birth_weight_lbs',
      purchase_price:   'purchase_price',
      purchase_date:    'purchase_date',
      vendor:           'vendor',
      notes:            'notes',
    }

    Object.entries(fieldMap).forEach(([apiKey, formKey]) => {
      if (fields[apiKey] != null && fields[apiKey] !== '') {
        setValue(formKey, String(fields[apiKey]), opts)
      }
    })

    // Convert breed + breed_percentage from voice into BreedSelector entries
    if (fields.breed) {
      const pct = fields.breed_percentage ? Number(fields.breed_percentage) : 100
      setBreeds([{ breed: String(fields.breed), pct: isNaN(pct) ? 100 : pct }])
    }

    setShowVoiceModal(false)
    setVoiceResult(null)
  }, [setValue])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const ext = mimeType === 'audio/mp4' ? 'mp4' : 'webm'

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        console.log('[voice] stop triggered')
        console.log('[voice] chunks:', chunksRef.current.length)
        stream.getTracks().forEach(t => t.stop())
        setRecording('processing')
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        console.log('[voice] blob size:', blob.size)
        const fd = new FormData()
        fd.append('audio', blob, `recording.${ext}`)
        try {
          console.log('[voice] sending to API')
          const res = await apiPost('/api/voice/transcribe', fd)
          console.log('[voice] response status:', res.status)
          const result = await res.json()
          console.log('[voice] result:', JSON.stringify(result))
          if (!res.ok) {
            console.error('[voice] API error:', result)
            return
          }
          // Store result and show confirmation modal — don't apply blindly
          setVoiceResult({ transcript: result.transcript, fields: result.fields ?? {} })
          setShowVoiceModal(true)
        } finally {
          setRecording('idle')
        }
      }
      mr.start()
      mediaRef.current = mr
      setRecording('recording')
    } catch {
      setRecording('idle')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop()
  }, [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      if (!pendingIdRef.current) {
        const res = await apiPost('/api/animals', { tag_number: watch('tag_number') || `DRAFT-${Date.now()}`, sex: watch('sex') || 'calf', ear_tag_color: watch('ear_tag_color') || 'Yellow', status: 'active' })
        if (!res.ok) return
        const data = await res.json()
        pendingIdRef.current = data.id
      }
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiPost(`/api/animals/${pendingIdRef.current}/photos`, fd)
      if (res.ok) {
        const data = await res.json()
        setPhotoUrls(data.photos)
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (breeds.length > 0) {
      const total = breeds.reduce((s, b) => s + (b.pct || 0), 0)
      if (total !== 100) { setBreedError('Breed percentages must total 100%'); return }
    }
    setBreedError('')
    setSaving(true)
    setError('')
    try {
      // sanitizePayload converts all "" → null so Postgres date/uuid fields don't reject empty strings
      const raw = sanitizePayload({
        ...values,
        birth_weight_lbs: toNum(values.birth_weight_lbs),
        purchase_price:   toNum(values.purchase_price),
        owner_id:         toUuid(values.owner_id),
        dam_id:           toUuid(values.dam_id),
        sire_id:          toUuid(values.sire_id),
        breeds:           breeds.length > 0 ? breeds : null,
        photos:           photoUrls,
        dob_estimated:    values.dob_estimated ?? false,
        approximate_age:  values.approximate_age || null,
      })

      if (isPair && pairCalf.tag_number.trim()) {
        raw.purchased_as_pair = true
        raw.calf_data = {
          tag_number:       pairCalf.tag_number.trim(),
          sex:              'calf',
          calf_sex:         pairCalf.calf_sex === 'calf' ? null : pairCalf.calf_sex,
          ear_tag_color:    pairCalf.ear_tag_color || values.ear_tag_color || null,
          dob:              pairCalf.dob || null,
          dob_estimated:    pairCalf.dob_estimated,
          birth_weight_lbs: pairCalf.birth_weight_lbs ? toNum(pairCalf.birth_weight_lbs) : null,
          status:           'active',
        }
      }

      let res: Response
      if (pendingIdRef.current) {
        res = await apiPatch(`/api/animals/${pendingIdRef.current}`, raw)
      } else {
        res = await apiPost('/api/animals', raw)
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      router.push(`/animals/${data.id ?? data.data?.id}`)
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer variant="narrow">
      <PageHeader title="Add Animal" subtitle="Register a new animal in your herd" />

      {/* Voice input strip */}
      <div
        className="rounded-[var(--radius-lg)] p-4 mb-6 flex items-start gap-3"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={recording === 'recording' ? stopRecording : startRecording}
          disabled={recording === 'processing'}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-150"
          style={{
            backgroundColor: recording === 'recording' ? 'var(--danger-fg)' : 'var(--accent)',
            color: '#fff',
            opacity: recording === 'processing' ? 0.5 : 1,
          }}
          title={recording === 'recording' ? 'Stop recording' : 'Start voice input'}
        >
          {recording === 'recording' ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="type-field-label mb-0.5">
            {recording === 'idle'       ? 'Voice input'   : ''}
            {recording === 'recording'  ? 'Recording…'    : ''}
            {recording === 'processing' ? 'Transcribing…' : ''}
          </p>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Tap the mic and describe the animal — review and apply fields automatically.
          </p>
        </div>
      </div>

      {/* Voice confirmation modal */}
      {showVoiceModal && voiceResult && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowVoiceModal(false) }}
        >
          <div
            className="w-full max-w-lg rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '85dvh', padding: '24px 20px' }}
          >
            <p className="type-panel-title mb-1">Voice Input Review</p>
            <p className="type-helper mb-4" style={{ color: 'var(--text-muted)' }}>
              Review what was captured. Tap Apply to fill the form.
            </p>

            {/* Transcript */}
            <div
              className="rounded-[var(--radius-md)] p-3 mb-4"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="type-field-label mb-1" style={{ color: 'var(--text-muted)' }}>Transcript</p>
              <p className="type-data-sm">{voiceResult.transcript}</p>
            </div>

            {/* Extracted fields */}
            {Object.keys(voiceResult.fields).length > 0 ? (
              <div className="flex flex-col gap-1 mb-5">
                <p className="type-field-label mb-2" style={{ color: 'var(--text-muted)' }}>Fields extracted</p>
                {Object.entries(voiceResult.fields).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{FIELD_LABELS[k] ?? k}</span>
                    <span className="type-data-sm font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="type-helper mb-5" style={{ color: 'var(--text-muted)' }}>
                No structured fields found — transcript saved above.
              </p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                intent="primary"
                onClick={() => applyVoiceFields(voiceResult.fields)}
              >
                APPLY TO FORM
              </Button>
              <Button
                type="button"
                intent="ghost"
                onClick={() => { setShowVoiceModal(false); setVoiceResult(null) }}
              >
                DISCARD
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Panel 1 — Identification */}
        <Panel title="IDENTIFICATION">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ear Tag Number" required error={errors.tag_number?.message}>
                <Input {...register('tag_number')} placeholder="e.g. 202" invalid={!!errors.tag_number} />
              </Field>
              <Field label="Name">
                <Input {...register('name')} placeholder="Optional nickname" />
              </Field>
              <Field label="Sex" required error={errors.sex?.message}>
                <Select {...register('sex')} invalid={!!errors.sex}>
                  <option value="">Select…</option>
                  <option value="bull">Bull</option>
                  <option value="cow">Cow</option>
                  <option value="heifer">Heifer</option>
                  <option value="steer">Steer</option>
                  <option value="calf">Calf</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select {...register('status')}>
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="deceased">Deceased</option>
                  <option value="transferred">Transferred</option>
                </Select>
              </Field>
              <div>
                <Field label="Date of birth">
                  <Input {...register('dob')} type="date" />
                </Field>
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" id="dob_estimated" {...register('dob_estimated')} className="rounded" />
                  <label htmlFor="dob_estimated" className="type-helper" style={{ color: 'var(--text-muted)' }}>
                    Date is estimated
                  </label>
                </div>
              </div>
              <Field label="Birth weight (lbs)">
                <Input {...register('birth_weight_lbs')} type="number" step="0.1" placeholder="0.0" />
              </Field>
              {dobEstimated && (
                <Field label="Approximate age" helper="e.g. '3 years old' or 'Spring 2023 calf'" className="sm:col-span-2">
                  <Input placeholder="e.g. 3 years" {...register('approximate_age')} />
                </Field>
              )}
            </div>

            {/* Ear tag color */}
            <div className="mt-4">
              <Field label="Ear tag color" required error={errors.ear_tag_color?.message}>
                <EarTagColorPicker
                  value={earTagColor}
                  onChange={v => setValue('ear_tag_color', v, { shouldValidate: true })}
                  invalid={!!errors.ear_tag_color}
                />
              </Field>
            </div>
          </PanelSection>
        </Panel>

        {/* Panel 2 — Breed */}
        <Panel title="BREED">
          <PanelSection>
            <BreedSelector value={breeds} onChange={setBreeds} error={breedError || undefined} />
          </PanelSection>
        </Panel>

        {/* Panel 3 — Purchase */}
        <Panel title="PURCHASE">
          <PanelSection>
            <Toggle
              checked={isPair}
              onChange={setIsPair}
              label="PURCHASED AS PAIR"
              description="This animal came with a calf. Create a linked calf record."
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <Field label="Purchase price ($)">
                <Input {...register('purchase_price')} type="number" step="0.01" placeholder="0.00" />
              </Field>
              <Field label="Purchase date">
                <Input {...register('purchase_date')} type="date" />
              </Field>
              <Field label="Vendor">
                <Input {...register('vendor')} placeholder="Name or operation" />
              </Field>
            </div>
          </PanelSection>
        </Panel>

        {/* Panel 3b — Pair Calf */}
        {isPair && (
          <Panel title="PAIR CALF" subtitle="Calf purchased with this animal">
            <PanelSection>
              <ContextBanner tone="info">
                Calf will be linked to this cow as dam. Owner will transfer automatically.
              </ContextBanner>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Field label="Calf tag number" required>
                  <Input
                    value={pairCalf.tag_number}
                    onChange={e => setPairCalf(p => ({ ...p, tag_number: e.target.value }))}
                    placeholder="e.g. 2501"
                  />
                </Field>
                <Field label="Calf sex" required>
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
                    <Input
                      type="date"
                      value={pairCalf.dob}
                      onChange={e => setPairCalf(p => ({ ...p, dob: e.target.value }))}
                    />
                  </Field>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id="pair_dob_est"
                      checked={pairCalf.dob_estimated}
                      onChange={e => setPairCalf(p => ({ ...p, dob_estimated: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="pair_dob_est" className="type-helper" style={{ color: 'var(--text-muted)' }}>
                      DOB is estimated
                    </label>
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
              <div className="mt-4">
                <Field label="Calf ear tag color">
                  <EarTagColorPicker
                    value={pairCalf.ear_tag_color || earTagColor}
                    onChange={v => setPairCalf(p => ({ ...p, ear_tag_color: v }))}
                    invalid={false}
                  />
                </Field>
              </div>
            </PanelSection>
          </Panel>
        )}

        {/* Panel 4 — Registration */}
        <Panel title="REGISTRATION NUMBERS">
          <PanelSection>
            <div className="flex flex-col gap-3">
              {regFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <Field label={i === 0 ? 'Registry' : undefined} className="flex-1">
                    <Input {...register(`registration_numbers.${i}.registry`)} placeholder="e.g. AAA" />
                  </Field>
                  <Field label={i === 0 ? 'Number' : undefined} className="flex-1">
                    <Input {...register(`registration_numbers.${i}.number`)} placeholder="12345678" />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeReg(i)}
                    className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-md)] shrink-0 transition-colors duration-150"
                    style={{ color: 'var(--danger-fg)', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <Button type="button" intent="ghost" size="sm" leading={<Plus size={14} />} onClick={() => addReg({ registry: '', number: '' })}>
                ADD REGISTRY
              </Button>
            </div>
          </PanelSection>
        </Panel>

        {/* Panel 5 — Lineage */}
        <Panel title="LINEAGE">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Dam ID" helper="UUID of dam record">
                <Input {...register('dam_id')} placeholder="Optional" />
              </Field>
              <Field label="Sire ID" helper="UUID of sire record">
                <Input {...register('sire_id')} placeholder="Optional" />
              </Field>
            </div>
          </PanelSection>
        </Panel>

        {/* Panel 5b — Owner */}
        <Panel title="OWNER">
          <PanelSection>
            <Field label="Owner" helper="Leave blank if this is your animal">
              <Select
                value={watch('owner_id') || ''}
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
              <div className="mt-3">
                <ContextBanner tone="info" eyebrow="DEFAULTS APPLIED">
                  Applied {defaultsApplied}&apos;s cattle defaults to this form. You can override any field.
                </ContextBanner>
              </div>
            )}
          </PanelSection>
        </Panel>

        {/* Panel 6 — Photos */}
        <Panel title="PHOTOS">
          <PanelSection>
            <div className="flex flex-wrap gap-3 mb-3">
              {photoUrls.map(url => (
                <div key={url} className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
            <label
              className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-[var(--radius-md)] transition-colors duration-150 type-button"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <Upload size={15} />
              {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </PanelSection>
        </Panel>

        {/* Panel 7 — Notes */}
        <Panel title="NOTES">
          <PanelSection>
            <Field label="Notes">
              <Textarea {...register('notes')} rows={4} placeholder="Any additional notes…" />
            </Field>
          </PanelSection>
        </Panel>

        {error && (
          <p
            className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
            style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
          >
            {error}
          </p>
        )}

        <ActionFooter
          primary={<Button type="submit" intent="primary" loading={saving}>SAVE ANIMAL</Button>}
          secondary={<Button type="button" intent="ghost" onClick={() => router.back()}>CANCEL</Button>}
        />
      </form>
    </PageContainer>
  )
}
