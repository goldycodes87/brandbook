'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

interface Rates {
  ai_tech_fee_per_cow: string
  treatment_labor_per_head: string
}

interface ExpenseCategory {
  id: string
  name: string
  description: string | null
}

const money = (v: string) => (v === '' ? '—' : `$${Number(v).toFixed(2)}`)

/**
 * What the ranch charges, and what an expense can be filed under.
 *
 * `canEdit` comes from the server: a CPA reaches this room to read the rates
 * behind an invoice and cannot change them. The API says the same thing, so
 * the flag is a courtesy to the eye rather than the actual gate.
 */
export function BillingRatesRoom({ canEdit }: { canEdit: boolean }) {
  const [rates, setRates]   = useState<Rates>({ ai_tech_fee_per_cow: '', treatment_labor_per_head: '' })
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat]   = useState(false)

  const loadCategories = useCallback(async () => {
    const j = await apiGet('/api/billing/expenses/categories').then(r => r.json())
    setCategories(Array.isArray(j.data) ? j.data : [])
  }, [])

  // Written out rather than routed through the callbacks — see PeopleAndRoles.
  useEffect(() => {
    Promise.all([
      apiGet('/api/admin/rates').then(r => r.json()),
      apiGet('/api/billing/expenses/categories').then(r => r.json()),
    ]).then(([r, c]) => {
      const d = r.data ?? {}
      setRates({
        ai_tech_fee_per_cow:      d.ai_tech_fee_per_cow      == null ? '' : String(d.ai_tech_fee_per_cow),
        treatment_labor_per_head: d.treatment_labor_per_head == null ? '' : String(d.treatment_labor_per_head),
      })
      setCategories(Array.isArray(c.data) ? c.data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function saveRates(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await apiPatch('/api/admin/rates', rates)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not save those rates'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    setAddingCat(true); setError('')
    try {
      const res = await apiPost('/api/billing/expenses/categories', { name: newCatName.trim() })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Could not add that category'); return }
      setNewCatName('')
      setShowAddCategory(false)
      await loadCategories()
    } finally { setAddingCat(false) }
  }

  const set = (k: keyof Rates) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRates(r => ({ ...r, [k]: e.target.value }))

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6 pb-8">
      {error && <ContextBanner tone="danger">{error}</ContextBanner>}
      {!canEdit && (
        <ContextBanner tone="info">
          You can read what the ranch charges. Changing a rate is the ranch&apos;s call.
        </ContextBanner>
      )}

      <form onSubmit={saveRates} className="flex flex-col gap-6">
        <Panel title="WHAT THE RANCH CHARGES" subtitle="Applied to every animal unless an owner's contract overrides it">
          <PanelSection>
            {canEdit ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="AI tech fee per cow ($)" helper="Default technician fee charged per cow bred">
                  <Input type="number" min="0" step="0.01" value={rates.ai_tech_fee_per_cow}
                         onChange={set('ai_tech_fee_per_cow')} placeholder="175.00" />
                </Field>
                <Field
                  label="Treatment labour per head ($)"
                  helper="Charged when the vet prescribes and you administer. Blank charges nothing."
                >
                  <Input type="number" min="0" step="0.01" value={rates.treatment_labor_per_head}
                         onChange={set('treatment_labor_per_head')} placeholder="15.00" />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="type-field-label" style={{ color: 'var(--text-muted)' }}>AI TECH FEE PER COW</p>
                  <p className="type-data" style={{ color: 'var(--text)' }}>{money(rates.ai_tech_fee_per_cow)}</p>
                </div>
                <div>
                  <p className="type-field-label" style={{ color: 'var(--text-muted)' }}>TREATMENT LABOUR PER HEAD</p>
                  <p className="type-data" style={{ color: 'var(--text)' }}>{money(rates.treatment_labor_per_head)}</p>
                </div>
              </div>
            )}
          </PanelSection>
        </Panel>

        {saved && <ContextBanner tone="success">Saved</ContextBanner>}

        {canEdit && (
          <div className="flex gap-3">
            <Button type="submit" intent="primary" loading={saving}>SAVE RATES</Button>
          </div>
        )}
      </form>

      <Panel title="EXPENSE CATEGORIES" subtitle="What a shared expense can be filed under">
        <PanelSection>
          <div className="flex flex-col gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between py-1.5"
                   style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="type-field-label" style={{ color: 'var(--text)' }}>{cat.name}</p>
                  {cat.description && (
                    <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{cat.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canEdit && (showAddCategory ? (
            <form onSubmit={addCategory} className="flex items-end gap-2 mt-3">
              <div className="flex-1">
                <Field label="Category name">
                  <Input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="e.g. Hauling"
                    autoFocus
                  />
                </Field>
              </div>
              <Button type="submit" intent="primary" size="sm" loading={addingCat}>ADD</Button>
              <Button type="button" intent="ghost" size="sm" onClick={() => setShowAddCategory(false)}>CANCEL</Button>
            </form>
          ) : (
            <Button
              intent="ghost" size="sm" className="mt-3"
              onClick={() => setShowAddCategory(true)}
              leading={<Plus size={14} />}
            >
              ADD CATEGORY
            </Button>
          ))}
        </PanelSection>
      </Panel>

      <Panel title="RATES THAT ARE NOT SET HERE" subtitle="Because they differ per owner">
        <PanelSection>
          <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>
              <strong>Grazing rate, calf share, death loss and sale fees</strong> are terms of one
              owner&apos;s contract, not a ranch-wide number. Each is set on that owner&apos;s
              contract{canEdit ? <> — <Link href="/admin/owners" style={{ color: 'var(--accent)' }}>OWNERS →</Link></> : null}.
            </p>
            <p>
              <strong>Per-animal AI fee overrides</strong> are set on the animal, on the breeding
              record, so the number that gets billed is the one that was agreed at the time.
            </p>
          </div>
        </PanelSection>
      </Panel>
    </div>
  )
}
