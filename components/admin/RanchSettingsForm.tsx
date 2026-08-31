'use client'

import { useState, useEffect, useRef } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { BrandDrawingPad } from '@/components/settings/BrandDrawingPad'
import { Check } from 'lucide-react'
import { apiGet, apiPatch } from '@/lib/fetch'

/**
 * The old Settings → Ranch Profile tab, unchanged, split across two rooms.
 *
 * One component rather than two because it was one form: a single state object
 * and a single PATCH to /api/settings/ranch. Splitting the SAVE as well as the
 * screen would mean two writes to one row, and a half-saved ranch record is a
 * worse problem than a long component.
 *
 * `show` picks which panels render. Both rooms load the whole row and send the
 * whole row, exactly as the single tab did.
 */

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

const BREEDS = ['Angus', 'Hereford', 'Simmental', 'Charolais', 'Limousin',
                'Gelbvieh', 'Red Angus', 'Shorthorn', 'Black Baldy', 'Crossbred']

export interface RanchSettings {
  ranch_name: string; owner_name: string; address: string; city: string
  state: string; zip: string; phone: string; email: string; timezone: string
  logo_url: string; brand_photo_url: string
  default_ear_tag_color: string; default_breed: string; default_administered_by: string
  ai_preg_check_days_out: string; default_ai_technician: string
  ai_tech_fee_per_cow: string; treatment_labor_per_head: string
}

const EMPTY: RanchSettings = {
  ranch_name: '', owner_name: '', address: '', city: '', state: '', zip: '',
  phone: '', email: '', timezone: 'America/Denver', logo_url: '', brand_photo_url: '',
  default_ear_tag_color: '', default_breed: '', default_administered_by: '',
  ai_preg_check_days_out: '', default_ai_technician: '', ai_tech_fee_per_cow: '',
  treatment_labor_per_head: '',
}

export function RanchSettingsForm({ show }: { show: 'profile' | 'defaults' }) {
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [form, setForm]   = useState<RanchSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    apiGet('/api/settings/ranch')
      .then(r => r.json())
      .then(d => {
        const s = d.data ?? d
        setForm(f => ({
          ...f,
          ...Object.fromEntries(Object.entries(s as Record<string, unknown>).map(([k, v]) => [k, v ?? ''])),
        }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const set = (k: keyof RanchSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleBrandSave = async (url: string) => {
    setForm(f => ({ ...f, brand_photo_url: url }))
    await apiPatch('/api/settings/ranch', { brand_photo_url: url })
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res  = await fetch('/api/settings/upload-logo', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.url) setForm(f => ({ ...f, logo_url: json.url }))
    } finally {
      setUploadingLogo(false)
      if (logoFileRef.current) logoFileRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await apiPatch('/api/settings/ranch', form)
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-8">

      {show === 'profile' && (
        <>
          <Panel title="RANCH PROFILE">
            <PanelSection>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ranch name">
                  <Input value={form.ranch_name} onChange={set('ranch_name')} placeholder="Circle K Ranch" />
                </Field>
                <Field label="Owner name">
                  <Input value={form.owner_name} onChange={set('owner_name')} placeholder="John Smith" />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" type="tel" />
                </Field>
                <Field label="Email">
                  <Input value={form.email} onChange={set('email')} placeholder="ranch@example.com" type="email" />
                </Field>
              </div>
            </PanelSection>
            <PanelSection>
              <Field label="Address">
                <Input value={form.address} onChange={set('address')} placeholder="123 Ranch Road" />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div className="col-span-2">
                  <Field label="City"><Input value={form.city} onChange={set('city')} placeholder="Laramie" /></Field>
                </div>
                <Field label="State"><Input value={form.state} onChange={set('state')} placeholder="WY" maxLength={2} /></Field>
                <Field label="ZIP"><Input value={form.zip} onChange={set('zip')} placeholder="82070" /></Field>
              </div>
            </PanelSection>
            <PanelSection>
              <Field label="Timezone">
                <Select value={form.timezone} onChange={set('timezone')}>
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Phoenix">Mountain (no DST)</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="America/Anchorage">Alaska</option>
                  <option value="Pacific/Honolulu">Hawaii</option>
                </Select>
              </Field>
            </PanelSection>
          </Panel>

          <Panel title="BRANDING">
            <PanelSection>
              <p className="type-field-label mb-3" style={{ color: 'var(--text)' }}>Ranch logo</p>
              <div className="flex items-center gap-4">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="h-14 w-auto max-w-[120px] object-contain rounded-lg"
                    style={{ border: '1px solid var(--border)', background: 'white', padding: 4 }}
                  />
                ) : (
                  <div
                    className="h-14 w-24 rounded-lg flex items-center justify-center"
                    style={{ border: '2px dashed var(--border)', background: 'var(--surface-2)' }}
                  >
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>No logo</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button type="button" intent="secondary" size="sm" loading={uploadingLogo}
                          onClick={() => logoFileRef.current?.click()}>
                    UPLOAD LOGO
                  </Button>
                  {form.logo_url && (
                    <Button type="button" intent="ghost" size="sm"
                            onClick={() => setForm(f => ({ ...f, logo_url: '' }))}>
                      REMOVE
                    </Button>
                  )}
                </div>
              </div>
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </PanelSection>
            <PanelSection>
              <p className="type-field-label mb-3" style={{ color: 'var(--text)' }}>Brand image</p>
              <BrandDrawingPad existingUrl={form.brand_photo_url || undefined} onSave={handleBrandSave} />
            </PanelSection>
          </Panel>
        </>
      )}

      {show === 'defaults' && (
        <>
          <Panel title="CATTLE DEFAULTS" subtitle="Applied to your animals when no owner is assigned">
            <PanelSection>
              <div className="flex flex-col gap-4">
                <Field label="Default ear tag color">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {EAR_TAG_COLORS.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        onClick={() => setForm(f => ({ ...f, default_ear_tag_color: f.default_ear_tag_color === c.name ? '' : c.name }))}
                        className="relative w-8 h-8 rounded-full transition-transform duration-100 active:scale-90"
                        style={{
                          backgroundColor: c.hex,
                          border: form.default_ear_tag_color === c.name ? '3px solid var(--accent)' : '2px solid var(--border)',
                          boxShadow: form.default_ear_tag_color === c.name ? '0 0 0 1px var(--accent)' : undefined,
                        }}
                      >
                        {form.default_ear_tag_color === c.name && (
                          <Check size={14} className="absolute inset-0 m-auto"
                            style={{ color: ['White', 'Yellow', 'Silver'].includes(c.name) ? '#000' : '#fff' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Default breed">
                  <Input value={form.default_breed} onChange={set('default_breed')} placeholder="e.g. Angus" list="ranch-breed-list" />
                  <datalist id="ranch-breed-list">
                    {BREEDS.map(b => <option key={b} value={b} />)}
                  </datalist>
                </Field>
                <Field label="Default administered by" helper="Pre-fills the 'administered by' field on health events">
                  <Input value={form.default_administered_by} onChange={set('default_administered_by')} placeholder="Your name or role" />
                </Field>
              </div>
            </PanelSection>
          </Panel>

          <Panel title="AI BREEDING DEFAULTS" subtitle="Used by Chute Mode and AI session when not overridden">
            <PanelSection>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Preg-check days after breeding" helper="Days to schedule a preg check after AI breeding">
                  <Input type="number" min="1" step="1" value={form.ai_preg_check_days_out}
                         onChange={set('ai_preg_check_days_out')} placeholder="45" />
                </Field>
                <Field label="Default AI technician" helper="Pre-fills the technician name on breeding records">
                  <Input value={form.default_ai_technician} onChange={set('default_ai_technician')} placeholder="Technician name" />
                </Field>
              </div>
            </PanelSection>
          </Panel>

          {/* These two are rates, not defaults, and belong in Billing & Rates.
              They stay here until that room is built so neither becomes
              unreachable in the meantime. */}
          <Panel title="RATES" subtitle="Moving to Billing & Rates">
            <PanelSection>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="AI tech fee per cow ($)" helper="Default technician fee charged per cow bred">
                  <Input type="number" min="0" step="0.01" value={form.ai_tech_fee_per_cow}
                         onChange={set('ai_tech_fee_per_cow')} placeholder="175.00" />
                </Field>
                <Field
                  label="Treatment labour per head ($)"
                  helper="Charged to the animal's owner when the vet prescribes and you administer. Blank charges nothing."
                >
                  <Input type="number" min="0" step="0.01" value={form.treatment_labor_per_head}
                         onChange={set('treatment_labor_per_head')} placeholder="15.00" />
                </Field>
              </div>
            </PanelSection>
          </Panel>
        </>
      )}

      {error && <ContextBanner tone="danger">{error}</ContextBanner>}
      {saved && <ContextBanner tone="success">Saved</ContextBanner>}

      <div className="flex gap-3">
        <Button type="submit" intent="primary" loading={saving}>SAVE</Button>
      </div>
    </form>
  )
}
