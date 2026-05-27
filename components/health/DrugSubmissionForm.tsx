'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'

const schema = z.object({
  brand_name:           z.string().min(1, 'Brand name is required'),
  generic_name:         z.string().optional(),
  manufacturer:         z.string().optional(),
  ndc_code:             z.string().optional(),
  route:                z.string().optional(),
  drug_class:           z.string().optional(),
  withdrawal_days_meat: z.string().optional(),
  withdrawal_days_milk: z.string().optional(),
  dosage_info:          z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function toNum(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

interface DrugSubmissionFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function DrugSubmissionForm({ onSuccess, onCancel }: DrugSubmissionFormProps) {
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/drugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          withdrawal_days_meat: toNum(values.withdrawal_days_meat),
          withdrawal_days_milk: toNum(values.withdrawal_days_milk),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed'); return }
      setDone(true)
      onSuccess?.()
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <ContextBanner tone="success" title="Drug submitted for review">
        It will appear in your drug list once approved. Thank you!
      </ContextBanner>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Brand name" required error={errors.brand_name?.message}>
        <Input {...register('brand_name')} placeholder="e.g. Draxxin" invalid={!!errors.brand_name} />
      </Field>
      <Field label="Generic name">
        <Input {...register('generic_name')} placeholder="e.g. tulathromycin" />
      </Field>
      <Field label="Manufacturer">
        <Input {...register('manufacturer')} placeholder="e.g. Zoetis" />
      </Field>
      <Field label="NDC / barcode">
        <Input {...register('ndc_code')} placeholder="e.g. 0054-1234-10" />
      </Field>
      <Field label="Route">
        <Select {...register('route')}>
          <option value="">Select…</option>
          <option value="Injectable">Injectable</option>
          <option value="Oral">Oral</option>
          <option value="Topical pour-on">Topical pour-on</option>
          <option value="Intramammary">Intramammary</option>
          <option value="Topical">Topical</option>
          <option value="Subcutaneous implant">Subcutaneous implant</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Meat withdrawal (days)">
          <Input {...register('withdrawal_days_meat')} type="number" min="0" placeholder="0" />
        </Field>
        <Field label="Milk withdrawal (days)">
          <Input {...register('withdrawal_days_milk')} type="number" min="0" placeholder="0" />
        </Field>
      </div>
      <Field label="Dosage info">
        <Textarea {...register('dosage_info')} rows={2} placeholder="Recommended dose and frequency…" />
      </Field>

      {error && (
        <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" intent="primary" loading={saving}>SUBMIT FOR REVIEW</Button>
        {onCancel && <Button type="button" intent="ghost" onClick={onCancel}>CANCEL</Button>}
      </div>
    </form>
  )
}
