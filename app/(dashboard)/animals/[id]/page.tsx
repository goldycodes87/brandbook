'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { StatusChip, Chip } from '@/components/ui/Chip'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ANIMAL_STATUS_CHIP, SEX_CHIP, HEALTH_EVENT_CHIP, WITHDRAWAL_CHIP, REPRO_CHIP, getSexValue, EAR_TAG_COLOR_HEX } from '@/components/ui/tokens'
import { Skeleton } from '@/components/ui/Skeleton'
import { HealthEventForm } from '@/components/health/HealthEventForm'
import { WeightForm } from '@/components/animals/WeightForm'
import { ReproEventForm } from '@/components/reproduction/ReproEventForm'
import { SellAnimalSheet } from '@/components/animals/SellAnimalSheet'
import { BreedDisplay } from '@/components/animals/BreedDisplay'
import { apiGet, apiDelete } from '@/lib/fetch'

type WeightRow     = { id: string; weight_lbs: number; weighed_at: string; source: string; notes: string | null }
type HealthEvent   = { id: string; event_type: string; event_date: string; drug_name?: string; dose_amount?: number; dose_unit?: string; withdrawal_days?: number; withdrawal_clear_date?: string; bcs_score?: number; administered_by?: string; notes?: string }
type ReproEvent    = { id: string; event_type: string; event_date: string; breed_method?: string; conception_method?: string; sire_name_text?: string; expected_calving_date?: string; calving_ease_score?: number; preg_check_result?: string; preg_check_method?: string; days_bred?: number; weaning_date?: string; weaning_weight_lbs?: number; ai_technician?: string; notes?: string; sire_id?: string; sire_library_id?: string; sire?: { id: string; tag_number: string; name?: string }; sire_library?: { id: string; bull_name: string; breed?: string | null; naab_code?: string | null; bull_type: string }; calf?: { id: string; tag_number: string; name?: string; sex?: string; calf_sex?: string; dob?: string; birth_weight_lbs?: number } }
type AnimalRef      = { id: string; tag_number: string; name?: string | null; breed?: string | null; sex?: string | null; status?: string | null; dob?: string | null }
type OwnerRef       = { id: string; name: string; email?: string; phone?: string }
type SireLibraryRef = { id: string; bull_name: string; breed?: string | null; naab_code?: string | null; stud?: string | null; bull_type: string }

interface Animal {
  id: string
  tag_number: string
  name: string | null
  dob: string | null
  dob_estimated: boolean | null
  approximate_age: string | null
  sex: string | null
  status: string | null
  breed: string | null
  breed_percentage: number | null
  breeds: { breed: string; pct: number }[] | null
  calf_sex: string | null
  ear_tag_color: string | null
  birth_weight_lbs: number | null
  birth_weight_estimated: boolean | null
  purchase_price: number | null
  purchase_date: string | null
  vendor: string | null
  photos: string[] | null
  brand_photo: string | null
  notes: string | null
  registration_numbers: { registry: string; number: string }[] | null
  created_at: string
  owner_id: string | null
  owner: OwnerRef | null
  dam: AnimalRef | null
  sire: AnimalRef | null
  sire_library_id: string | null
  sire_library: SireLibraryRef | null
  purchased_as_pair: boolean | null
  pair_animal_id: string | null
  pair_animal: AnimalRef | null
  calves: AnimalRef[]
  weights: WeightRow[]
  health_events: HealthEvent[]
  reproduction_events: ReproEvent[]
}

type Tab = 'overview' | 'health' | 'reproduction' | 'weights' | 'documents'

const TABS = [
  { value: 'overview'     as Tab, label: 'OVERVIEW' },
  { value: 'health'       as Tab, label: 'HEALTH' },
  { value: 'reproduction' as Tab, label: 'REPRODUCTION' },
  { value: 'weights'      as Tab, label: 'WEIGHTS' },
  { value: 'documents'    as Tab, label: 'DOCUMENTS' },
]

function calcAge(dob: string | null): string {
  if (!dob) return '—'
  const ms   = Date.now() - new Date(dob).getTime()
  const days = Math.floor(ms / 86400000)
  if (days < 30)  return `${days} days`
  if (days < 365) return `${Math.floor(days / 30)} months`
  const yrs = Math.floor(days / 365)
  const mo  = Math.floor((days % 365) / 30)
  return mo ? `${yrs}yr ${mo}mo` : `${yrs} years`
}

function fmt(n: number | null | undefined, unit = ''): string {
  if (n == null) return '—'
  return `${n}${unit ? ' ' + unit : ''}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function WeightSparkline({ weights }: { weights: WeightRow[] }) {
  if (weights.length < 2) return null
  const sorted = [...weights].sort((a, b) => new Date(a.weighed_at).getTime() - new Date(b.weighed_at).getTime())
  const vals = sorted.map(w => w.weight_lbs)
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)
  const range = max - min || 1
  const W = 200, H = 48, pad = 4

  const pts = sorted.map((w, i) => {
    const x = pad + (i / (sorted.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (w.weight_lbs - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="w-full max-w-[200px]">
      <polyline
        points={pts.join(' ')}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)" />
      })}
    </svg>
  )
}

function OverviewTab({ animal, onDelete, ranchName }: { animal: Animal; onDelete: () => void; ranchName?: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await apiDelete(`/api/animals/${animal.id}`)
      if (res.ok) onDelete()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const latestWeight = animal.weights.length
    ? [...animal.weights].sort((a, b) => new Date(b.weighed_at).getTime() - new Date(a.weighed_at).getTime())[0]
    : null

  return (
    <div className="flex flex-col gap-5">
      {/* Photo gallery */}
      {(animal.photos?.length ?? 0) > 0 && (
        <Panel title="PHOTOS" padding="sm">
          <div className="flex gap-3 flex-wrap p-1">
            {animal.photos!.map(url => (
              <div key={url} className="w-28 h-28 rounded-[var(--radius-md)] overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                <Image src={url} alt={animal.tag_number} width={112} height={112} className="object-cover w-full h-full" />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Age',    value: animal.dob ? calcAge(animal.dob) : (animal.approximate_age ? `~${animal.approximate_age}` : '—') },
          { label: 'Weight', value: latestWeight ? `${latestWeight.weight_lbs} lb` : '—' },
          { label: 'Breed',  value: <BreedDisplay breeds={animal.breeds} breed={animal.breed} breedPercentage={animal.breed_percentage} /> },
          { label: 'Sex',    value: animal.sex ? <StatusChip map={SEX_CHIP} value={getSexValue(animal.sex, animal.calf_sex)} /> : '—' },
        ].map(s => (
          <div key={s.label} className="rounded-[var(--radius-lg)] p-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <p className="type-section-label mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="type-data-lg" style={{ color: 'var(--text)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <Panel title="DETAILS">
        <PanelSection>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {[
              { k: 'Tag number',   v: (
                  <div className="flex items-center gap-1.5">
                    {animal.ear_tag_color && (
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: EAR_TAG_COLOR_HEX[animal.ear_tag_color] ?? '#888', border: '1px solid var(--border)' }}
                      />
                    )}
                    {animal.tag_number}
                    {animal.ear_tag_color && <span className="type-helper" style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{animal.ear_tag_color}</span>}
                  </div>
                ) },
              { k: 'Date of birth',v: animal.dob_estimated
                  ? (animal.approximate_age
                      ? `~${animal.approximate_age} (est.)`
                      : `~${fmtDate(animal.dob)} (est.)`)
                  : fmtDate(animal.dob) },
              { k: 'Birth weight', v: animal.birth_weight_lbs != null ? `${animal.birth_weight_lbs} lb${animal.birth_weight_estimated ? ' (est.)' : ''}` : '—' },
              { k: 'Purchase date',v: fmtDate(animal.purchase_date) },
              { k: 'Purchase price',v: animal.purchase_price != null ? `$${animal.purchase_price.toLocaleString()}` : '—' },
              { k: 'Vendor',       v: animal.vendor ?? '—' },
              { k: 'Owner',        v: animal.owner?.name ?? ranchName ?? '—' },
            ].map(({ k, v }) => (
              <div key={k}>
                <dt className="type-field-label mb-0.5" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                <dd className="type-data-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </PanelSection>
      </Panel>

      {/* Registration numbers */}
      {(animal.registration_numbers?.length ?? 0) > 0 && (
        <Panel title="REGISTRATION NUMBERS">
          <PanelSection>
            {animal.registration_numbers!.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <Chip tone="neutral" size="sm">{r.registry}</Chip>
                <span className="type-mono type-data-sm" style={{ color: 'var(--text-secondary)' }}>{r.number}</span>
              </div>
            ))}
          </PanelSection>
        </Panel>
      )}

      {/* Family tree */}
      {(animal.dam || animal.sire || animal.sire_library || animal.calves?.length > 0) && (
        <Panel title="LINEAGE">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>DAM</p>
                {animal.dam ? (
                  <Link href={`/animals/${animal.dam.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
                    {animal.dam.tag_number}{animal.dam.name ? ` — ${animal.dam.name}` : ''}
                  </Link>
                ) : <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>Unknown</span>}
              </div>
              <div>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>SIRE</p>
                {animal.sire ? (
                  <Link href={`/animals/${animal.sire.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
                    {animal.sire.tag_number}{animal.sire.name ? ` — ${animal.sire.name}` : ''}
                  </Link>
                ) : animal.sire_library ? (
                  <div>
                    <Link href={`/genetics/sires/${animal.sire_library.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
                      {animal.sire_library.bull_name}
                    </Link>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="type-helper px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '10px' }}>AI SIRE</span>
                      {animal.sire_library.naab_code && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{animal.sire_library.naab_code}</span>}
                    </div>
                  </div>
                ) : <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>Unknown</span>}
              </div>
              <div>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>CALVES</p>
                {animal.calves?.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {animal.calves.map(c => (
                      <Link key={c.id} href={`/animals/${c.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
                        {c.tag_number}{c.name ? ` — ${c.name}` : ''}
                      </Link>
                    ))}
                  </div>
                ) : <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>None on record</span>}
              </div>
            </div>
          </PanelSection>
        </Panel>
      )}

      {/* Pair animal */}
      {animal.purchased_as_pair && animal.pair_animal && (
        <Panel title="PURCHASED AS PAIR">
          <PanelSection>
            <p className="type-helper mb-2" style={{ color: 'var(--text-muted)' }}>
              {animal.sex === 'calf' || animal.sex === 'heifer_calf' || animal.sex === 'bull_calf' ? 'Purchased with cow:' : 'Pair calf:'}
            </p>
            <Link href={`/animals/${animal.pair_animal.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
              #{animal.pair_animal.tag_number}{animal.pair_animal.name ? ` — ${animal.pair_animal.name}` : ''}
            </Link>
          </PanelSection>
        </Panel>
      )}

      {/* Notes */}
      {animal.notes && (
        <Panel title="NOTES">
          <PanelSection>
            <p className="type-body" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{animal.notes}</p>
          </PanelSection>
        </Panel>
      )}

      {/* Danger Zone */}
      <Panel title="DANGER ZONE">
        <PanelSection>
          <p className="type-body mb-3" style={{ color: 'var(--text-muted)' }}>
            Permanently delete this animal and all associated records. This cannot be undone.
          </p>
          <Button intent="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            DELETE ANIMAL
          </Button>
        </PanelSection>
      </Panel>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete animal?"
        message={`This will permanently delete #${animal.tag_number}${animal.name ? ` — ${animal.name}` : ''} and all associated health, weight, and reproduction records. This cannot be undone.`}
        confirmLabel="DELETE ANIMAL"
        loading={deleting}
      />
    </div>
  )
}

function HealthTab({ animal, onLogEvent, onRefresh }: { animal: Animal; onLogEvent: () => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState<HealthEvent | null>(null)

  const events = [...(animal.health_events ?? [])].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )
  const today = new Date()
  const inWithdrawal = events.filter(ev => ev.withdrawal_clear_date && new Date(ev.withdrawal_clear_date) > today)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button intent="primary" size="sm" onClick={onLogEvent}>+ LOG EVENT</Button>
      </div>

      {inWithdrawal.length > 0 && (
        <ContextBanner tone="danger" emphasis eyebrow={`${inWithdrawal.length} ACTIVE WITHDRAWAL${inWithdrawal.length !== 1 ? 'S' : ''}`}>
          {inWithdrawal.map(ev => (
            <div key={ev.id} className="flex items-center justify-between gap-2">
              <span>{ev.drug_name ?? ev.event_type}</span>
              <span className="type-helper" style={{ color: 'var(--danger-fg)' }}>
                Clear: {fmtDate(ev.withdrawal_clear_date)}
              </span>
            </div>
          ))}
        </ContextBanner>
      )}

      {!events.length ? (
        <div className="py-12 text-center type-body" style={{ color: 'var(--text-muted)' }}>
          No health events recorded.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(ev => {
            const withdrawalActive = ev.withdrawal_clear_date && new Date(ev.withdrawal_clear_date) > today
            return (
              <div
                key={ev.id}
                className="rounded-[var(--radius-lg)] p-4"
                style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setEditing(ev)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusChip map={HEALTH_EVENT_CHIP} value={ev.event_type} size="sm" />
                    {ev.withdrawal_clear_date && (
                      <StatusChip map={WITHDRAWAL_CHIP} value={withdrawalActive ? 'active' : 'clear'} size="sm" />
                    )}
                  </div>
                  <span className="type-data-sm shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.event_date)}</span>
                </div>
                {(ev.drug_name || ev.dose_amount) && (
                  <p className="type-data-sm mb-1">
                    {ev.drug_name}{ev.dose_amount ? ` — ${ev.dose_amount}${ev.dose_unit ? ' ' + ev.dose_unit : ''}` : ''}
                    {ev.withdrawal_days ? ` (${ev.withdrawal_days}d withdrawal)` : ''}
                  </p>
                )}
                {ev.bcs_score != null && (
                  <p className="type-data-sm mb-1" style={{ color: 'var(--text-secondary)' }}>BCS: {ev.bcs_score}</p>
                )}
                {ev.administered_by && (
                  <p className="type-data-sm mb-1" style={{ color: 'var(--text-secondary)' }}>By: {ev.administered_by}</p>
                )}
                {ev.withdrawal_clear_date && (
                  <p className="type-data-sm" style={{ color: withdrawalActive ? 'var(--danger-fg)' : 'var(--success-fg)' }}>
                    Clear date: {fmtDate(ev.withdrawal_clear_date)}
                  </p>
                )}
                {ev.notes && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>{ev.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}
        >
          <div
            className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] overflow-y-auto w-full md:max-w-lg"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '92dvh', padding: '24px 16px' }}
          >
            <p className="type-panel-title mb-4">Edit Health Event</p>
            <HealthEventForm
              animalId={animal.id}
              eventId={editing.id}
              initialData={editing}
              mode="edit"
              onSuccess={() => { setEditing(null); onRefresh() }}
              onCancel={() => setEditing(null)}
              onDelete={() => { setEditing(null); onRefresh() }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ReproTab({ animal, onLogEvent, onRefresh }: { animal: Animal; onLogEvent: () => void; onRefresh: () => void }) {
  const [confirmReproId, setConfirmReproId] = useState<string | null>(null)
  const [deletingReproId, setDeletingReproId] = useState<string | null>(null)

  const handleDeleteRepro = async () => {
    if (!confirmReproId) return
    setDeletingReproId(confirmReproId)
    try {
      await apiDelete(`/api/reproduction/${confirmReproId}`)
      onRefresh()
    } finally {
      setDeletingReproId(null)
      setConfirmReproId(null)
    }
  }

  const events = [...(animal.reproduction_events ?? [])].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )

  const isFemale = animal.sex === 'cow' || animal.sex === 'heifer'
  const isCalf   = animal.sex === 'calf' || animal.sex === 'bull' || animal.sex === 'steer'

  // Determine current pregnancy status for cows/heifers
  let pregnancyBanner: React.ReactNode = null
  if (isFemale && events.length > 0) {
    const lastBred    = events.find(e => e.event_type === 'bred')
    const lastCalved  = events.find(e => e.event_type === 'calved')
    const lastPreg    = events.find(e => e.event_type === 'preg_check')

    const bredAfterCalved = lastBred && (!lastCalved || new Date(lastBred.event_date) > new Date(lastCalved.event_date))

    if (bredAfterCalved && lastBred) {
      const daysBred = Math.floor((Date.now() - new Date(lastBred.event_date).getTime()) / 86400000)
      const estCalving = lastBred.expected_calving_date

      if (lastPreg?.preg_check_result === 'confirmed') {
        pregnancyBanner = (
          <ContextBanner tone="success" eyebrow="CONFIRMED PREGNANT">
            Bred {daysBred} days ago{estCalving ? ` · Expected calving: ${fmtDate(estCalving)}` : ''}
          </ContextBanner>
        )
      } else if (lastPreg?.preg_check_result === 'open') {
        pregnancyBanner = (
          <ContextBanner tone="warning" eyebrow="OPEN">
            Preg check negative — consider re-breeding
          </ContextBanner>
        )
      } else {
        pregnancyBanner = (
          <ContextBanner tone="info" eyebrow="BRED">
            Bred {daysBred} days ago{estCalving ? ` · Est. calving: ${fmtDate(estCalving)}` : ''}
          </ContextBanner>
        )
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button intent="primary" size="sm" onClick={onLogEvent}>+ LOG EVENT</Button>
      </div>

      {pregnancyBanner}

      {/* Calves grid for cows/heifers */}
      {isFemale && animal.calves && animal.calves.length > 0 && (
        <Panel title="CALVES">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {animal.calves.map(c => (
              <Link key={c.id} href={`/animals/${c.id}`}>
                <div
                  className="rounded-[var(--radius-lg)] p-3 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <p className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{c.tag_number}</p>
                  {c.name && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{c.name}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.sex && <StatusChip map={SEX_CHIP} value={getSexValue(c.sex, (c as { calf_sex?: string | null }).calf_sex)} size="sm" />}
                  </div>
                  {c.dob && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>DOB: {fmtDate(c.dob)}</p>}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {/* Dam/sire/donor for calves */}
      {animal.sex === 'calf' && (animal.dam || animal.sire) && (
        <Panel title="PARENTAGE">
          <PanelSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {animal.dam && (
                <div>
                  <p className="type-section-label mb-1" style={{ color: 'var(--text-muted)' }}>DAM</p>
                  <Link href={`/animals/${animal.dam.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
                    #{animal.dam.tag_number}{animal.dam.name ? ` — ${animal.dam.name}` : ''}
                  </Link>
                </div>
              )}
              {animal.sire && (
                <div>
                  <p className="type-section-label mb-1" style={{ color: 'var(--text-muted)' }}>SIRE</p>
                  <Link href={`/animals/${animal.sire.id}`} className="type-data-sm hover:underline" style={{ color: 'var(--accent)' }}>
                    #{animal.sire.tag_number}{animal.sire.name ? ` — ${animal.sire.name}` : ''}
                  </Link>
                </div>
              )}
            </div>
          </PanelSection>
        </Panel>
      )}

      {/* Event history */}
      {!events.length ? (
        <div className="py-8 text-center type-body" style={{ color: 'var(--text-muted)' }}>
          No reproduction events recorded.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(ev => {
            const displayDate = ev.event_type === 'calved' && ev.calf?.dob
              ? ev.calf.dob
              : ev.event_date

            let detail: React.ReactNode = null
            if (ev.event_type === 'calved' && ev.calf) {
              const sexLabel = ev.calf.calf_sex === 'heifer_calf' ? 'Heifer' : ev.calf.calf_sex === 'bull_calf' ? 'Bull' : ''
              detail = `${sexLabel ? sexLabel + ' Calf ' : 'Calf '}#${ev.calf.tag_number}${ev.calf.birth_weight_lbs ? ` · ${ev.calf.birth_weight_lbs} lbs` : ' · wt unknown'}`
            } else if (ev.event_type === 'bred') {
              const method = ev.breed_method === 'ai' ? 'AI' : ev.conception_method === 'ai' ? 'AI' : 'Natural Service'
              detail = `${method}${ev.expected_calving_date ? ` · Est. calving: ${fmtDate(ev.expected_calving_date)}` : ''}`
            } else if (ev.event_type === 'preg_check') {
              detail = `${(ev.preg_check_result ?? 'Unknown').toUpperCase()}${ev.days_bred ? ` · ${ev.days_bred} days bred` : ''}`
            } else if (ev.event_type === 'weaned') {
              detail = `Weaned at ${ev.weaning_weight_lbs ? `${ev.weaning_weight_lbs} lbs` : 'unknown weight'}`
            }

            return (
              <div key={ev.id} className="rounded-[var(--radius-lg)] p-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <StatusChip map={REPRO_CHIP} value={ev.event_type} size="sm" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>{fmtDate(displayDate)}</span>
                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      onClick={() => setConfirmReproId(ev.id)}
                      style={{ color: 'var(--danger-fg)', padding: '2px 6px' }}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                {detail && (
                  <p className="type-data-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{detail}</p>
                )}

                {/* Sire display */}
                {ev.sire_library ? (
                  <p className="type-data-sm mb-1">
                    Sire:{' '}
                    <Link href={`/genetics/sires/${ev.sire_library.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                      {ev.sire_library.bull_name}
                    </Link>
                    <span className="ml-1.5 px-1.5 py-0.5 rounded type-helper" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '10px' }}>AI</span>
                    {ev.sire_library.naab_code && <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>{ev.sire_library.naab_code}</span>}
                  </p>
                ) : ev.sire ? (
                  <p className="type-data-sm mb-1">
                    Sire: <Link href={`/animals/${ev.sire.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                      #{ev.sire.tag_number}{ev.sire.name ? ` — ${ev.sire.name}` : ''}
                    </Link>
                  </p>
                ) : ev.sire_name_text ? (
                  <p className="type-data-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Sire: {ev.sire_name_text}</p>
                ) : null}

                {/* Calf link for calved events */}
                {ev.calf && (
                  <p className="type-data-sm mb-1">
                    <Link href={`/animals/${ev.calf.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                      View calf #{ev.calf.tag_number} →
                    </Link>
                  </p>
                )}

                {ev.calving_ease_score != null && (
                  <p className="type-data-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Ease score: {ev.calving_ease_score}</p>
                )}
                {ev.ai_technician && (
                  <p className="type-data-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Technician: {ev.ai_technician}</p>
                )}
                {ev.notes && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>{ev.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmReproId}
        onClose={() => setConfirmReproId(null)}
        onConfirm={handleDeleteRepro}
        title="Delete reproduction event?"
        message="This reproduction event will be permanently deleted. This cannot be undone."
        confirmLabel="DELETE EVENT"
        loading={!!deletingReproId}
      />
    </div>
  )
}

function WeightsTab({ animal, onLogWeight, onRefresh }: { animal: Animal; onLogWeight: () => void; onRefresh: () => void }) {
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [confirmId, setConfirmId]       = useState<string | null>(null)

  const weights  = [...(animal.weights ?? [])].sort((a, b) => new Date(b.weighed_at).getTime() - new Date(a.weighed_at).getTime())
  const ascending = [...weights].reverse()

  const handleDeleteWeight = async () => {
    if (!confirmId) return
    setDeletingId(confirmId)
    try {
      await apiDelete(`/api/animals/${animal.id}/weights/${confirmId}`)
      onRefresh()
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button intent="primary" size="sm" onClick={onLogWeight}>+ LOG WEIGHT</Button>
      </div>

      {!weights.length ? (
        <div className="py-12 text-center type-body" style={{ color: 'var(--text-muted)' }}>No weight records.</div>
      ) : (
        <div className="flex flex-col gap-5">
          {weights.length >= 2 && (
            <Panel title="TREND">
              <PanelSection>
                <WeightSparkline weights={ascending} />
                <p className="type-data-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  {weights[weights.length - 1].weight_lbs} → {weights[0].weight_lbs} lb
                  {(() => {
                    const gain = weights[0].weight_lbs - weights[weights.length - 1].weight_lbs
                    const days = Math.abs((new Date(weights[0].weighed_at).getTime() - new Date(weights[weights.length - 1].weighed_at).getTime()) / 86400000)
                    const adg  = days > 0 ? (gain / days).toFixed(2) : null
                    return adg ? ` · ADG ${adg} lb/day` : ''
                  })()}
                </p>
              </PanelSection>
            </Panel>
          )}
          <div className="flex flex-col gap-2">
            {weights.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-3" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="type-data-sm font-semibold">{w.weight_lbs} lb</p>
                  {w.notes && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{w.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="type-data-sm" style={{ color: 'var(--text-muted)' }}>{fmtDate(w.weighed_at)}</p>
                    <Chip tone="neutral" size="sm">{w.source}</Chip>
                  </div>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={() => setConfirmId(w.id)}
                    style={{ color: 'var(--danger-fg)', padding: '4px 8px' }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDeleteWeight}
        title="Delete weight record?"
        message="This weight record will be permanently deleted."
        confirmLabel="DELETE"
        loading={!!deletingId}
      />
    </div>
  )
}

export default function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [animal, setAnimal]         = useState<Animal | null>(null)
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<Tab>('overview')
  const [logOpen, setLogOpen]         = useState(false)
  const [weightOpen, setWeightOpen]   = useState(false)
  const [reproOpen, setReproOpen]     = useState(false)
  const [sellOpen, setSellOpen]       = useState(false)
  const [ranchName, setRanchName]     = useState<string | undefined>(undefined)

  const fetchAnimal = useCallback(() => {
    apiGet(`/api/animals/${id}`)
      .then(async r => {
        if (!r.ok) { setLoading(false); return }
        const { data } = await r.json()
        setAnimal(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchAnimal() }, [fetchAnimal])

  useEffect(() => {
    apiGet('/api/settings/ranch')
      .then(r => r.json())
      .then(d => { const s = d.data ?? d; if (s.ranch_name) setRanchName(s.ranch_name) })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Skeleton h={32} w={192} className="mb-2" />
          <Skeleton h={16} w={128} />
        </div>
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} h={96} />)}
        </div>
      </PageContainer>
    )
  }

  if (!animal) {
    return (
      <PageContainer>
        <PageHeader title="Animal not found" />
        <ButtonLink href="/animals" intent="secondary">← Back to Animals</ButtonLink>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href="/animals" style={{ color: 'var(--text-muted)' }}>Animals</Link>}
        title={`${animal.tag_number}${animal.name ? ` — ${animal.name}` : ''}`}
        subtitle={animal.breed ?? undefined}
        actions={
          <>
            <StatusChip map={ANIMAL_STATUS_CHIP} value={animal.status} />
            {animal.sex && <StatusChip map={SEX_CHIP} value={getSexValue(animal.sex, animal.calf_sex)} />}
            <ButtonLink href={`/animals/${id}/edit`} intent="secondary" size="sm">EDIT</ButtonLink>
          </>
        }
      />

      {/* Quick action bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: 'none' }}>
        <Button intent="secondary" size="sm" onClick={() => setWeightOpen(true)}>LOG WEIGHT</Button>
        <Button intent="secondary" size="sm" onClick={() => setLogOpen(true)}>HEALTH EVENT</Button>
        {animal.sex !== 'steer' && (
          <Button intent="secondary" size="sm" onClick={() => setReproOpen(true)}>REPRO EVENT</Button>
        )}
        {animal.status === 'active' && (
          <Button
            intent="secondary"
            size="sm"
            style={{ borderColor: 'var(--success-border)', color: 'var(--success-fg)' }}
            onClick={() => setSellOpen(true)}
          >
            SELL
          </Button>
        )}
        <ButtonLink href={`/animals/${id}/edit`} intent="ghost" size="sm">EDIT ANIMAL</ButtonLink>
      </div>

      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-5" />

      {tab === 'overview'      && <OverviewTab  animal={animal} onDelete={() => router.push('/animals')} ranchName={ranchName} />}
      {tab === 'health'        && <HealthTab    animal={animal} onLogEvent={() => setLogOpen(true)} onRefresh={fetchAnimal} />}
      {tab === 'reproduction'  && <ReproTab     animal={animal} onLogEvent={() => setReproOpen(true)} onRefresh={fetchAnimal} />}
      {tab === 'weights'       && <WeightsTab   animal={animal} onLogWeight={() => setWeightOpen(true)} onRefresh={fetchAnimal} />}
      {tab === 'documents'     && (
        <div className="py-12 text-center type-body" style={{ color: 'var(--text-muted)' }}>
          Document storage coming soon.
        </div>
      )}

      {/* Weight slide-up sheet */}
      {weightOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] overflow-y-auto w-full md:max-w-lg"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh', padding: '24px 16px' }}
          >
            <p className="type-panel-title mb-4">Log Weight</p>
            <WeightForm
              animalId={id}
              onSuccess={() => { setWeightOpen(false); fetchAnimal() }}
              onCancel={() => setWeightOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Health event slide-up sheet */}
      {logOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] overflow-y-auto w-full md:max-w-lg"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh', padding: '24px 16px' }}
          >
            <p className="type-panel-title mb-4">Log Health Event</p>
            <HealthEventForm
              animalId={id}
              onSuccess={() => { setLogOpen(false); fetchAnimal() }}
              onCancel={() => setLogOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Reproduction event slide-up sheet */}
      {reproOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] overflow-y-auto w-full md:max-w-lg"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '92dvh', padding: '24px 16px' }}
          >
            <p className="type-panel-title mb-1">Log Reproduction Event</p>
            <p className="type-helper mb-4" style={{ color: 'var(--text-muted)' }}>
              Animal: <strong style={{ color: 'var(--text)' }}>#{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}</strong>
            </p>
            <ReproEventForm
              animalId={id}
              animalSex={animal.sex ?? 'cow'}
              animalRef={{ id, tag_number: animal.tag_number, name: animal.name }}
              onSuccess={() => { setReproOpen(false); fetchAnimal() }}
              onCancel={() => setReproOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Sell animal sheet */}
      <SellAnimalSheet
        isOpen={sellOpen}
        onClose={() => setSellOpen(false)}
        animal={{ id, tag_number: animal.tag_number, name: animal.name, sex: animal.sex }}
        onSuccess={() => { setSellOpen(false); fetchAnimal() }}
      />
    </PageContainer>
  )
}
