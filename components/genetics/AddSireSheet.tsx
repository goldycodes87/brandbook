'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { SireLibraryRecord } from './SireCard'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/fetch'

const schema = z.object({
  bull_name:           z.string().min(1, 'Name required'),
  bull_type:           z.string(),
  breed:               z.string().optional(),
  registration_number: z.string().optional(),
  naab_code:           z.string().optional(),
  stud:                z.string().optional(),
  birth_year:          z.string().optional(),
  notes:               z.string().optional(),
  epd_bw:       z.string().optional(), epd_ww:    z.string().optional(),
  epd_yw:       z.string().optional(), epd_milk:  z.string().optional(),
  epd_tm:       z.string().optional(), epd_cw:    z.string().optional(),
  epd_rea:      z.string().optional(), epd_fat:   z.string().optional(),
  epd_marbling: z.string().optional(),
  epd_dollar_w: z.string().optional(), epd_dollar_f: z.string().optional(),
  epd_dollar_g: z.string().optional(), epd_dollar_b: z.string().optional(),
  acc_bw:  z.string().optional(), acc_ww:  z.string().optional(), acc_yw:  z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const BULL_TYPES = [
  { value: 'ai_sire', label: 'AI SIRE' },
  { value: 'owned',   label: 'OWNED' },
  { value: 'leased',  label: 'LEASED' },
]

interface AddSireSheetProps {
  open: boolean
  onClose: () => void
  editSire?: SireLibraryRecord | null
  onSuccess?: () => void
}

export function AddSireSheet({ open, onClose, editSire, onSuccess }: AddSireSheetProps) {
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [confirmDel, setConfirmDel]     = useState(false)
  const [error, setError]               = useState('')
  const [isActive, setIsActive]         = useState(true)
  const [photoUrl, setPhotoUrl]         = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEdit = !!editSire

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { bull_type: 'ai_sire' },
  })

  const bullType = watch('bull_type')

  useEffect(() => {
    if (open) {
      setError('')
      setPendingPhoto(null)
      if (editSire) {
        setIsActive(editSire.is_active)
        setPhotoUrl(editSire.photo_url ?? null)
        reset({
          bull_name:           editSire.bull_name,
          bull_type:           editSire.bull_type,
          breed:               editSire.breed ?? '',
          naab_code:           editSire.naab_code ?? '',
          stud:                editSire.stud ?? '',
          birth_year:          editSire.birth_year ? String(editSire.birth_year) : '',
          epd_bw:    toStr((editSire as any).epd_bw),    epd_ww:   toStr((editSire as any).epd_ww),
          epd_yw:    toStr((editSire as any).epd_yw),    epd_milk: toStr((editSire as any).epd_milk),
          epd_tm:    toStr((editSire as any).epd_tm),    epd_cw:   toStr((editSire as any).epd_cw),
          epd_rea:   toStr((editSire as any).epd_rea),   epd_fat:  toStr((editSire as any).epd_fat),
          epd_marbling:  toStr((editSire as any).epd_marbling),
          epd_dollar_w:  toStr((editSire as any).epd_dollar_w),
          epd_dollar_f:  toStr((editSire as any).epd_dollar_f),
          epd_dollar_g:  toStr((editSire as any).epd_dollar_g),
          epd_dollar_b:  toStr((editSire as any).epd_dollar_b),
          acc_bw: toStr((editSire as any).acc_bw), acc_ww: toStr((editSire as any).acc_ww), acc_yw: toStr((editSire as any).acc_yw),
          notes: (editSire as any).notes ?? '',
        })
      } else {
        setIsActive(true)
        setPhotoUrl(null)
        reset({ bull_type: 'ai_sire' })
      }
    }
  }, [open, editSire, reset])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (isEdit && editSire) {
      setUploadingPhoto(true)
      try {
        const fd = new FormData()
        fd.append('photo', file)
        const res = await fetch(`/api/genetics/sires/${editSire.id}/photo`, { method: 'POST', body: fd })
        const json = await res.json()
        if (res.ok) setPhotoUrl(json.url)
        else setError(json.error ?? 'Photo upload failed')
      } catch {
        setError('Photo upload failed')
      } finally {
        setUploadingPhoto(false)
      }
    } else {
      setPendingPhoto(file)
      setPhotoUrl(URL.createObjectURL(file))
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        bull_name:           values.bull_name,
        bull_type:           values.bull_type,
        breed:               values.breed || null,
        registration_number: values.registration_number || null,
        naab_code:           values.naab_code || null,
        stud:                values.stud || null,
        birth_year:          values.birth_year ? Number(values.birth_year) : null,
        is_active:           isActive,
        notes:               values.notes || null,
        epd_source:          'manual',
        epd_bw:    toNum(values.epd_bw),    epd_ww:   toNum(values.epd_ww),
        epd_yw:    toNum(values.epd_yw),    epd_milk: toNum(values.epd_milk),
        epd_tm:    toNum(values.epd_tm),    epd_cw:   toNum(values.epd_cw),
        epd_rea:   toNum(values.epd_rea),   epd_fat:  toNum(values.epd_fat),
        epd_marbling:  toNum(values.epd_marbling),
        epd_dollar_w:  toNum(values.epd_dollar_w), epd_dollar_f: toNum(values.epd_dollar_f),
        epd_dollar_g:  toNum(values.epd_dollar_g), epd_dollar_b: toNum(values.epd_dollar_b),
        acc_bw: toNum(values.acc_bw), acc_ww: toNum(values.acc_ww), acc_yw: toNum(values.acc_yw),
      }

      const url = isEdit ? `/api/genetics/sires/${editSire!.id}` : '/api/genetics/sires'
      const res = await (isEdit ? apiPatch(url, payload) : apiPost(url, payload))
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }

      if (!isEdit && pendingPhoto) {
        const newId = json.data?.id
        if (newId) {
          const fd = new FormData()
          fd.append('photo', pendingPhoto)
          await fetch(`/api/genetics/sires/${newId}/photo`, { method: 'POST', body: fd })
        }
      }

      onClose()
      onSuccess?.()
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editSire) return
    setDeleting(true)
    try {
      const res = await apiDelete(`/api/genetics/sires/${editSire.id}`)
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Delete failed')
        setConfirmDel(false)
        return
      }
      onClose()
      onSuccess?.()
    } catch {
      setError('Connection error')
    } finally {
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] w-full md:max-w-lg flex flex-col"
          style={{
            background: 'var(--surface-1)',
            borderTop: '1px solid var(--border)',
            maxHeight: '90dvh',
          }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          {/* Header */}
          <div className="px-4 pb-2 flex-shrink-0">
            <h2 className="type-heading">{isEdit ? 'EDIT SIRE' : 'ADD SIRE'}</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-4">
              {/* Photo */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex-shrink-0"
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                      style={{ border: '1px solid var(--border)' }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center"
                      style={{ border: '2px dashed var(--border)', background: 'var(--surface-2)' }}
                    >
                      <Camera size={22} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                </button>
                <div className="flex flex-col gap-0.5">
                  <span className="type-field-label">Bull photo</span>
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                    {uploadingPhoto ? 'Uploading…' : photoUrl ? 'Tap to change' : 'Optional'}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              {/* Identity */}
              <Field label="Bull type">
                <SegmentedControl
                  value={bullType}
                  onChange={v => setValue('bull_type', v)}
                  items={BULL_TYPES}
                  block size="sm"
                />
              </Field>

              <Field label="Bull name" required error={errors.bull_name?.message}>
                <Input {...register('bull_name')} placeholder="e.g. Angus Flagship" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="NAAB code"><Input {...register('naab_code')} placeholder="7AN935" /></Field>
                <Field label="Breed"><Input {...register('breed')} placeholder="Angus" /></Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Stud / AI company"><Input {...register('stud')} placeholder="ABS" /></Field>
                <Field label="Birth year"><Input {...register('birth_year')} type="number" min="1990" max="2030" placeholder="2022" /></Field>
              </div>

              <Field label="Registration #">
                <Input {...register('registration_number')} placeholder="20249872" />
              </Field>

              {/* EPDs */}
              <SectionDivider label="EPD VALUES" />
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="BW"><Input {...register('epd_bw')} type="number" step="0.1" placeholder="+1.5" /></Field>
                <Field label="WW"><Input {...register('epd_ww')} type="number" step="0.1" placeholder="+60" /></Field>
                <Field label="YW"><Input {...register('epd_yw')} type="number" step="0.1" placeholder="+100" /></Field>
                <Field label="Milk"><Input {...register('epd_milk')} type="number" step="0.1" placeholder="+25" /></Field>
                <Field label="TM"><Input {...register('epd_tm')} type="number" step="0.1" placeholder="+55" /></Field>
                <Field label="CW"><Input {...register('epd_cw')} type="number" step="0.1" placeholder="+40" /></Field>
                <Field label="REA"><Input {...register('epd_rea')} type="number" step="0.01" placeholder="+0.35" /></Field>
                <Field label="Fat"><Input {...register('epd_fat')} type="number" step="0.001" placeholder="+0.010" /></Field>
                <Field label="Marb"><Input {...register('epd_marbling')} type="number" step="0.01" placeholder="+0.55" /></Field>
              </div>

              <SectionDivider label="DOLLAR INDEXES" />
              <div className="grid grid-cols-4 gap-2">
                <Field label="$W"><Input {...register('epd_dollar_w')} type="number" step="0.01" placeholder="+80" /></Field>
                <Field label="$F"><Input {...register('epd_dollar_f')} type="number" step="0.01" placeholder="+95" /></Field>
                <Field label="$G"><Input {...register('epd_dollar_g')} type="number" step="0.01" placeholder="+40" /></Field>
                <Field label="$B"><Input {...register('epd_dollar_b')} type="number" step="0.01" placeholder="+175" /></Field>
              </div>

              <SectionDivider label="ACCURACY" />
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Acc BW"><Input {...register('acc_bw')} type="number" step="0.01" min="0" max="1" placeholder="0.72" /></Field>
                <Field label="Acc WW"><Input {...register('acc_ww')} type="number" step="0.01" min="0" max="1" placeholder="0.68" /></Field>
                <Field label="Acc YW"><Input {...register('acc_yw')} type="number" step="0.01" min="0" max="1" placeholder="0.65" /></Field>
              </div>

              {/* Status + Notes */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="type-field-label">Active in library</span>
              </label>

              <Field label="Notes">
                <Textarea {...register('notes')} rows={2} placeholder="Additional details…" />
              </Field>

              {error && (
                <p
                  className="type-helper px-3 py-2 rounded"
                  style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
                >
                  {error}
                </p>
              )}
            </div>

            {/* Footer — always visible */}
            <div
              className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              {isEdit && (
                <Button type="button" intent="danger" size="sm" onClick={() => setConfirmDel(true)}>DELETE</Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" intent="ghost" onClick={onClose}>CANCEL</Button>
                <Button type="submit" intent="primary" loading={saving}>{isEdit ? 'UPDATE SIRE' : 'ADD SIRE'}</Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="Delete sire?"
        message="This sire will be permanently removed from the library."
        confirmLabel="DELETE SIRE"
        loading={deleting}
      />
    </>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div
      className="type-section-label px-3 py-1.5 rounded"
      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
    >
      {label}
    </div>
  )
}

function toStr(v: unknown): string {
  return v != null ? String(v) : ''
}

function toNum(v: string | undefined | null): number | null {
  if (!v?.trim()) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
