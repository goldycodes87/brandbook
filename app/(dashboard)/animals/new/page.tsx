'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mic, MicOff, Plus, Trash2, Upload } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ActionFooter } from '@/components/ui/ActionFooter'

const schema = z.object({
  tag_number:        z.string().min(1, 'Tag number is required'),
  name:              z.string().optional(),
  sex:               z.string().optional(),
  dob:               z.string().optional(),
  status:            z.string().optional(),
  breed:             z.string().optional(),
  breed_percentage:  z.string().optional(),
  birth_weight_lbs:  z.string().optional(),
  purchase_price:    z.string().optional(),
  purchase_date:     z.string().optional(),
  vendor:            z.string().optional(),
  dam_id:            z.string().optional(),
  sire_id:           z.string().optional(),
  owner_id:          z.string().optional(),
  notes:             z.string().optional(),
  registration_numbers: z.array(z.object({
    registry: z.string().min(1),
    number:   z.string().min(1),
  })).optional(),
})

type FormValues = z.infer<typeof schema>

function toNum(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

type RecordingState = 'idle' | 'recording' | 'processing'

export default function NewAnimalPage() {
  const router = useRouter()
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [recording, setRecording]     = useState<RecordingState>('idle')
  const [transcript, setTranscript]   = useState('')
  const [photoUrls, setPhotoUrls]     = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const mediaRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const pendingIdRef = useRef<string | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors }, control } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', registration_numbers: [] },
  })

  const { fields: regFields, append: addReg, remove: removeReg } = useFieldArray({
    control,
    name: 'registration_numbers',
  })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording('processing')
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'recording.webm')
        try {
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
          const data = await res.json()
          if (res.ok) {
            setTranscript(data.transcript)
            const f = data.fields as Record<string, unknown>
            if (f.tag_number)       setValue('tag_number', String(f.tag_number))
            if (f.name)             setValue('name', String(f.name))
            if (f.sex)              setValue('sex', String(f.sex))
            if (f.dob)              setValue('dob', String(f.dob))
            if (f.breed)            setValue('breed', String(f.breed))
            if (f.breed_percentage) setValue('breed_percentage', String(f.breed_percentage))
            if (f.birth_weight_lbs) setValue('birth_weight_lbs', String(f.birth_weight_lbs))
            if (f.purchase_price)   setValue('purchase_price', String(f.purchase_price))
            if (f.purchase_date)    setValue('purchase_date', String(f.purchase_date))
            if (f.vendor)           setValue('vendor', String(f.vendor))
            if (f.notes)            setValue('notes', String(f.notes))
          }
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
  }, [setValue])

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop()
  }, [])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      if (!pendingIdRef.current) {
        const res = await fetch('/api/animals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_number: watch('tag_number') || `DRAFT-${Date.now()}`, status: 'active' }),
        })
        if (!res.ok) return
        const data = await res.json()
        pendingIdRef.current = data.id
      }
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/animals/${pendingIdRef.current}/photos`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setPhotoUrls(data.photos)
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...values,
        breed_percentage: toNum(values.breed_percentage),
        birth_weight_lbs: toNum(values.birth_weight_lbs),
        purchase_price:   toNum(values.purchase_price),
        photos: photoUrls,
      }

      let res: Response
      if (pendingIdRef.current) {
        res = await fetch(`/api/animals/${pendingIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/animals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      router.push(`/animals/${data.id}`)
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
            {recording === 'idle'       ? 'Voice input'       : ''}
            {recording === 'recording'  ? 'Recording…'        : ''}
            {recording === 'processing' ? 'Transcribing…'     : ''}
          </p>
          {transcript ? (
            <p className="type-data-sm" style={{ color: 'var(--text-secondary)' }}>{transcript}</p>
          ) : (
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Tap the mic and describe the animal — fields will be filled automatically.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Panel 1 — Identification */}
        <Panel title="IDENTIFICATION">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tag number" required error={errors.tag_number?.message}>
                <Input {...register('tag_number')} placeholder="e.g. 1045" invalid={!!errors.tag_number} />
              </Field>
              <Field label="Name">
                <Input {...register('name')} placeholder="Optional nickname" />
              </Field>
              <Field label="Sex">
                <Select {...register('sex')}>
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
              <Field label="Date of birth">
                <Input {...register('dob')} type="date" />
              </Field>
              <Field label="Birth weight (lbs)">
                <Input {...register('birth_weight_lbs')} type="number" step="0.1" placeholder="0.0" />
              </Field>
            </div>
          </PanelSection>
        </Panel>

        {/* Panel 2 — Breed */}
        <Panel title="BREED">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Breed">
                <Input {...register('breed')} placeholder="e.g. Angus" />
              </Field>
              <Field label="Breed %" helper="Leave blank for purebred">
                <Input {...register('breed_percentage')} type="number" min="0" max="100" placeholder="100" />
              </Field>
            </div>
          </PanelSection>
        </Panel>

        {/* Panel 3 — Purchase */}
        <Panel title="PURCHASE">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    className="h-10 w-10 flex items-center justify-center rounded-[var(--radius-md)] mb-0 shrink-0 transition-colors duration-150"
                    style={{ color: 'var(--danger-fg)', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                intent="ghost"
                size="sm"
                leading={<Plus size={14} />}
                onClick={() => addReg({ registry: '', number: '' })}
              >
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
