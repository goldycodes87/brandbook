'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ActionFooter } from '@/components/ui/ActionFooter'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DrugSelector, type DrugRecord } from '@/components/health/DrugSelector'
import type { SegmentItem } from '@/components/ui/SegmentedControl'

type EventType = 'treatment' | 'vaccine' | 'vet_visit' | 'illness' | 'bcs_log'

const EVENT_TYPES: SegmentItem<EventType>[] = [
  { value: 'treatment', label: 'TREATMENT' },
  { value: 'vaccine',   label: 'VACCINE' },
  { value: 'vet_visit', label: 'VET VISIT' },
  { value: 'illness',   label: 'ILLNESS' },
  { value: 'bcs_log',  label: 'BCS LOG' },
]

const schema = z.object({
  event_date:      z.string().min(1, 'Date is required'),
  drug_name_text:  z.string().optional(),
  dose_amount:     z.string().optional(),
  dose_unit:       z.string().optional(),
  withdrawal_days: z.string().optional(),
  bcs_score:       z.string().optional(),
  administered_by: z.string().optional(),
  notes:           z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export interface HealthEventData {
  id?: string
  event_type: string
  event_date: string
  drug_name?: string | null
  dose_amount?: number | null
  dose_unit?: string | null
  withdrawal_days?: number | null
  withdrawal_clear_date?: string | null
  bcs_score?: number | null
  administered_by?: string | null
  notes?: string | null
}

interface HealthEventFormProps {
  animalId: string
  eventId?: string
  initialData?: HealthEventData
  mode?: 'create' | 'edit'
  onSuccess?: () => void
  onCancel?: () => void
  onDelete?: () => void
}

function toNum(v: string | undefined | null): number | null {
  if (v == null || String(v).trim() === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function HealthEventForm({ animalId, eventId, initialData, mode = 'create', onSuccess, onCancel, onDelete }: HealthEventFormProps) {
  const isEdit = mode === 'edit'

  const [eventType, setEventType]         = useState<EventType>((initialData?.event_type as EventType) ?? 'treatment')
  const [drug, setDrug]                   = useState<DrugRecord | null>(null)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [error, setError]                 = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const showDrug = eventType === 'treatment' || eventType === 'vaccine'

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      event_date:      initialData?.event_date ?? new Date().toISOString().slice(0, 10),
      drug_name_text:  initialData?.drug_name ?? '',
      dose_amount:     initialData?.dose_amount != null ? String(initialData.dose_amount) : '',
      dose_unit:       initialData?.dose_unit ?? '',
      withdrawal_days: initialData?.withdrawal_days != null ? String(initialData.withdrawal_days) : '',
      bcs_score:       initialData?.bcs_score != null ? String(initialData.bcs_score) : '',
      administered_by: initialData?.administered_by ?? '',
      notes:           initialData?.notes ?? '',
    },
  })

  useEffect(() => {
    if (initialData) {
      setEventType((initialData.event_type as EventType) ?? 'treatment')
      reset({
        event_date:      initialData.event_date,
        drug_name_text:  initialData.drug_name ?? '',
        dose_amount:     initialData.dose_amount != null ? String(initialData.dose_amount) : '',
        dose_unit:       initialData.dose_unit ?? '',
        withdrawal_days: initialData.withdrawal_days != null ? String(initialData.withdrawal_days) : '',
        bcs_score:       initialData.bcs_score != null ? String(initialData.bcs_score) : '',
        administered_by: initialData.administered_by ?? '',
        notes:           initialData.notes ?? '',
      })
    }
  }, [initialData, reset])

  const eventDate      = watch('event_date')
  const withdrawalDays = toNum(watch('withdrawal_days')) ?? (drug ? (drug.withdrawal_days_meat ?? null) : null)
  const clearDate      = withdrawalDays && eventDate ? addDays(new Date(eventDate), withdrawalDays) : null

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    setError('')
    try {
      const drugName = isEdit ? (values.drug_name_text || null) : (drug ? drug.brand_name : null)
      const payload: Record<string, unknown> = {
        animal_id:            animalId,
        event_type:           eventType,
        event_date:           values.event_date,
        drug_name:            drugName,
        dose_amount:          toNum(values.dose_amount),
        dose_unit:            values.dose_unit || null,
        withdrawal_days:      withdrawalDays,
        withdrawal_clear_date: clearDate,
        bcs_score:            toNum(values.bcs_score),
        administered_by:      values.administered_by || null,
        notes:                values.notes || null,
      }

      const url    = isEdit ? `/api/health/${eventId}` : '/api/health'
      const method = isEdit ? 'PATCH' : 'POST'

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess?.()
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/health/${eventId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Delete failed')
        setConfirmDelete(false)
        return
      }
      onDelete?.()
      onSuccess?.()
    } catch {
      setError('Connection error')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Event type">
          <SegmentedControl
            value={eventType}
            onChange={v => setEventType(v as EventType)}
            items={EVENT_TYPES}
            block size="sm"
          />
        </Field>

        <Field label="Date" required error={errors.event_date?.message}>
          <Input {...register('event_date')} type="date" invalid={!!errors.event_date} />
        </Field>

        {showDrug && (
          isEdit ? (
            <Field label="Drug name">
              <Input {...register('drug_name_text')} placeholder="Drug name" />
            </Field>
          ) : (
            <Field label="Drug">
              <DrugSelector value={drug} onChange={setDrug} />
            </Field>
          )
        )}

        {showDrug && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dose amount">
              <Input {...register('dose_amount')} type="number" step="0.01" placeholder="0.0" />
            </Field>
            <Field label="Unit">
              <Select {...register('dose_unit')}>
                <option value="">Select…</option>
                <option value="mL">mL</option>
                <option value="cc">cc</option>
                <option value="mg">mg</option>
                <option value="g">g</option>
                <option value="lb">lb</option>
                <option value="tablet">tablet</option>
              </Select>
            </Field>
          </div>
        )}

        {showDrug && (
          <Field label="Withdrawal days" helper="Override drug default">
            <Input {...register('withdrawal_days')} type="number" min="0"
              placeholder={String(drug?.withdrawal_days_meat ?? '')} />
          </Field>
        )}

        {clearDate && (
          <ContextBanner tone="warning" emphasis eyebrow="WITHDRAWAL PREVIEW">
            Meat clear date: <strong>{new Date(clearDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </ContextBanner>
        )}

        {(eventType === 'bcs_log' || eventType === 'vet_visit' || eventType === 'illness') && (
          <Field label="BCS score" helper="1–9 scale">
            <Input {...register('bcs_score')} type="number" step="0.5" min="1" max="9" placeholder="5.0" />
          </Field>
        )}

        <Field label="Administered by">
          <Input {...register('administered_by')} placeholder="Name or role" />
        </Field>

        <Field label="Notes">
          <Textarea {...register('notes')} rows={3} placeholder="Observations, symptoms, instructions…" />
        </Field>

        {error && (
          <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
            style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
            {error}
          </p>
        )}

        <ActionFooter
          primary={<Button type="submit" intent="primary" loading={saving}>{isEdit ? 'UPDATE EVENT' : 'SAVE EVENT'}</Button>}
          secondary={onCancel ? <Button type="button" intent="ghost" onClick={onCancel}>CANCEL</Button> : undefined}
        />

        {isEdit && (
          <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <Button type="button" intent="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              DELETE EVENT
            </Button>
          </div>
        )}
      </form>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete health event?"
        message="This health event will be permanently deleted. This cannot be undone."
        confirmLabel="DELETE EVENT"
        loading={deleting}
      />
    </>
  )
}
