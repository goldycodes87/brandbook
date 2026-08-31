'use client'

import { useState, useEffect, useCallback } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

interface Drug {
  id: string
  brand_name: string
  generic_name: string | null
  manufacturer: string | null
  ndc_code: string | null
  route: string | null
  drug_class: string | null
  source: string | null
  is_active: boolean
  use_count: number | null
  withdrawal_days_meat: number | null
  withdrawal_days_milk: number | null
  dosage_info: string | null
}

const EMPTY_NEW = {
  brand_name: '', generic_name: '', manufacturer: '',
  route: '', drug_class: '', dosage_info: '',
  withdrawal_days_meat: '', withdrawal_days_milk: '0',
}

export function DrugLibraryRoom() {
  const [drugs, setDrugs]   = useState<Drug[]>([])
  const [counts, setCounts] = useState({ active: 0, retired: 0 })
  const [shelf, setShelf]   = useState<'active' | 'retired'>('active')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(EMPTY_NEW)

  // Withdrawal days being edited, keyed by drug id. Held apart from `drugs` so
  // a half-typed number never looks like a saved one.
  const [edits, setEdits] = useState<Record<string, { meat: string; milk: string }>>({})

  const query = useCallback(
    (shelfNow: string, searchNow: string) =>
      `/api/admin/drugs?retired=${shelfNow === 'retired' ? '1' : '0'}` +
      (searchNow.trim() ? `&search=${encodeURIComponent(searchNow.trim())}` : ''),
    [],
  )

  const load = useCallback(async () => {
    const res = await apiGet(query(shelf, search))
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Could not load the library'); return }
    setDrugs(j.data ?? [])
    setCounts(j.counts ?? { active: 0, retired: 0 })
    setEdits({})
  }, [query, shelf, search])

  // Written out rather than routed through `load` — see PeopleAndRoles.
  useEffect(() => {
    let live = true
    apiGet(query(shelf, search))
      .then(r => r.json())
      .then(j => {
        if (!live) return
        setDrugs(j.data ?? [])
        setCounts(j.counts ?? { active: 0, retired: 0 })
        setLoading(false)
      })
      .catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [query, shelf, search])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id); setError('')
    try {
      const res = await apiPatch(`/api/admin/drugs/${id}`, body)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not save that'); return }
      await load()
    } finally { setBusy(null) }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy('add'); setError('')
    try {
      const res = await apiPost('/api/admin/drugs', form)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not add that product'); return }
      setForm(EMPTY_NEW)
      setAdding(false)
      await load()
    } finally { setBusy(null) }
  }

  const editOf = (d: Drug) =>
    edits[d.id] ?? { meat: String(d.withdrawal_days_meat ?? 0), milk: String(d.withdrawal_days_milk ?? 0) }

  const dirty = (d: Drug) => {
    const e = edits[d.id]
    if (!e) return false
    return Number(e.meat) !== (d.withdrawal_days_meat ?? 0) || Number(e.milk) !== (d.withdrawal_days_milk ?? 0)
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6 pb-8">
      {error && <ContextBanner tone="danger">{error}</ContextBanner>}

      <ContextBanner tone="info">
        A withdrawal comes off the product label. What is typed here is what every
        treatment is measured against, so it is worth being right the first time.
      </ContextBanner>

      <div className="flex flex-col gap-3">
        <SegmentedControl
          value={shelf}
          onChange={v => setShelf(v as 'active' | 'retired')}
          items={[
            { value: 'active',  label: `In use (${counts.active})` },
            { value: 'retired', label: `Retired (${counts.retired})` },
          ]}
        />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by brand or generic name"
        />
      </div>

      {shelf === 'retired' && (
        <ContextBanner tone="neutral">
          Retired products stay in the library so an old treatment record still
          says what was actually given. Most of these came in from an FDA import
          and carried no real withdrawal, which is why they are off the shelf.
        </ContextBanner>
      )}

      {drugs.length === 0 ? (
        <EmptyState
          variant="neutral"
          title={search ? 'Nothing matches that' : 'Nothing on this shelf'}
          body={search ? 'Try part of the brand or generic name.' : 'Add a product below.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {drugs.map(d => {
            const e = editOf(d)
            return (
              <div key={d.id} className="px-4 py-3 rounded-[var(--radius-lg)]"
                   style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {d.brand_name}
                    </p>
                    <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>
                      {[d.generic_name, d.manufacturer, d.route, d.drug_class].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {d.ndc_code && <Chip tone="neutral" size="sm">IMPORTED</Chip>}
                      {(d.use_count ?? 0) > 0 && <Chip tone="neutral" size="sm">USED {d.use_count}×</Chip>}
                    </div>
                  </div>
                  <Button
                    intent="ghost" size="sm" loading={busy === d.id}
                    onClick={() => patch(d.id, { is_active: !d.is_active })}
                  >
                    {d.is_active ? 'RETIRE' : 'PUT BACK'}
                  </Button>
                </div>

                <div className="flex flex-wrap items-end gap-3 mt-3">
                  <div style={{ width: 110 }}>
                    <Field label="Meat days">
                      <Input
                        type="number" min={0} inputMode="numeric"
                        value={e.meat}
                        onChange={ev => setEdits(s => ({ ...s, [d.id]: { ...editOf(d), meat: ev.target.value } }))}
                      />
                    </Field>
                  </div>
                  <div style={{ width: 110 }}>
                    <Field label="Milk days">
                      <Input
                        type="number" min={0} inputMode="numeric"
                        value={e.milk}
                        onChange={ev => setEdits(s => ({ ...s, [d.id]: { ...editOf(d), milk: ev.target.value } }))}
                      />
                    </Field>
                  </div>
                  {dirty(d) && (
                    <Button
                      intent="primary" size="sm" loading={busy === d.id}
                      onClick={() => patch(d.id, {
                        withdrawal_days_meat: Number(e.meat),
                        withdrawal_days_milk: Number(e.milk),
                      })}
                    >
                      SAVE
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Panel title="ADD A PRODUCT" subtitle="Goes straight onto the shelf the vet picks from">
        <PanelSection>
          {adding ? (
            <form onSubmit={add} className="flex flex-col gap-4">
              <Field label="Product name" helper="What is printed on the bottle">
                <Input required value={form.brand_name}
                       onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
                       placeholder="Draxxin" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Generic name">
                  <Input value={form.generic_name}
                         onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
                         placeholder="Tulathromycin" />
                </Field>
                <Field label="Manufacturer">
                  <Input value={form.manufacturer}
                         onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
                </Field>
                <Field label="Route">
                  <Input value={form.route}
                         onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                         placeholder="SubQ" />
                </Field>
                <Field label="Class">
                  <Input value={form.drug_class}
                         onChange={e => setForm(f => ({ ...f, drug_class: e.target.value }))}
                         placeholder="Antibiotic" />
                </Field>
                <Field label="Meat withdrawal (days)" helper="Off the label — required">
                  <Input required type="number" min={0} inputMode="numeric"
                         value={form.withdrawal_days_meat}
                         onChange={e => setForm(f => ({ ...f, withdrawal_days_meat: e.target.value }))} />
                </Field>
                <Field label="Milk withdrawal (days)">
                  <Input type="number" min={0} inputMode="numeric"
                         value={form.withdrawal_days_milk}
                         onChange={e => setForm(f => ({ ...f, withdrawal_days_milk: e.target.value }))} />
                </Field>
              </div>
              <Field label="Dosage" helper="How it is dosed, in your own words">
                <Input value={form.dosage_info}
                       onChange={e => setForm(f => ({ ...f, dosage_info: e.target.value }))}
                       placeholder="1.1 mL / 100 lb" />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" intent="primary" loading={busy === 'add'}>ADD PRODUCT</Button>
                <Button type="button" intent="ghost" onClick={() => { setAdding(false); setForm(EMPTY_NEW) }}>
                  CANCEL
                </Button>
              </div>
            </form>
          ) : (
            <Button intent="ghost" onClick={() => setAdding(true)}>+ ADD A PRODUCT</Button>
          )}
        </PanelSection>
      </Panel>
    </div>
  )
}
