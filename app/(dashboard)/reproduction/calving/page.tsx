'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input, SearchField, Textarea } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { StatusChip } from '@/components/ui/Chip'
import { EarTagColorPicker } from '@/components/reproduction/EarTagColorPicker'
import { SireSelector } from '@/components/reproduction/SireSelector'
import { SEX_CHIP, getSexValue } from '@/components/ui/tokens'
import { EarTagDot } from '@/components/ui/EarTagDot'
import type { SegmentItem } from '@/components/ui/SegmentedControl'
import Link from 'next/link'
import { apiGet, apiPost } from '@/lib/fetch'
import { calcCalfBreeds, type BreedEntry } from '@/lib/breed-calculator'

function normalizeColor(c: string): string {
  return c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : c
}

function getDamBreeds(dam: Dam | null): BreedEntry[] {
  if (!dam) return []
  console.log('[BREED DEBUG] getDamBreeds — id:', dam.id, 'breeds:', JSON.stringify(dam.breeds), 'breed:', dam.breed)
  if (dam.breeds && dam.breeds.length > 0) return dam.breeds
  if (dam.breed) return [{ breed: dam.breed, pct: 100 }]
  console.log('[BREED DEBUG] getDamBreeds: no breeds found')
  return []
}

function getSireBreeds(sireBreed: string | null): BreedEntry[] {
  console.log('[BREED DEBUG] getSireBreeds — sireBreed:', sireBreed)
  if (sireBreed) return [{ breed: sireBreed, pct: 100 }]
  console.log('[BREED DEBUG] getSireBreeds: no sire breed')
  return []
}

type CalfSex = 'heifer_calf' | 'bull_calf' | 'calf'
type BirthType = 'single' | 'twin_a' | 'twin_b'
type ConceptionMethod = 'natural' | 'ai' | 'embryo'

interface Dam {
  id: string
  tag_number: string
  name: string | null
  breed: string | null
  breeds?: BreedEntry[] | null
  ear_tag_color: string | null
  sex: string | null
  last_bred?: string | null
  expected_calving?: string | null
}

interface CalfRecord {
  tag_number: string
  sex: string
  dam_tag: string
  id: string
}

const CALF_SEX_ITEMS: SegmentItem<CalfSex>[] = [
  { value: 'heifer_calf', label: 'HEIFER CALF' },
  { value: 'bull_calf',   label: 'BULL CALF' },
  { value: 'calf',        label: 'UNKNOWN' },
]

const BIRTH_TYPE_ITEMS: SegmentItem<BirthType>[] = [
  { value: 'single', label: 'SINGLE' },
  { value: 'twin_a', label: 'TWIN A' },
  { value: 'twin_b', label: 'TWIN B' },
]

const CONCEPTION_ITEMS: SegmentItem<ConceptionMethod>[] = [
  { value: 'natural', label: 'NATURAL' },
  { value: 'ai',      label: 'AI' },
  { value: 'embryo',  label: 'EMBRYO' },
]

const EASE_ITEMS: SegmentItem<string>[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
]

const VIGOR_ITEMS: SegmentItem<string>[] = [
  { value: '1', label: '1 WEAK' },
  { value: '2', label: '2 NORMAL' },
  { value: '3', label: '3 STRONG' },
]


function blankCalfState() {
  return {
    calfTag:          '',
    calfColor:        null as string | null,
    calfSex:          'heifer_calf' as CalfSex,
    calfDob:          new Date().toISOString().slice(0, 10),
    calfWeight:       '',
    calfEstWeight:    true,
    birthType:        'single' as BirthType,
    vigor:            '2',
    conception:       'natural' as ConceptionMethod,
    calveEase:        '1',
    sireId:           null as string | null,
    sireName:         null as string | null,
    sireLibraryId:    null as string | null,
    sireKnown:        true,
    calfNotes:        '',
  }
}

export default function CalvingEntryPage() {
  const router   = useRouter()
  const tagRef   = useRef<HTMLInputElement>(null)

  const [dam, setDam]               = useState<Dam | null>(null)
  const [search, setSearch]         = useState('')
  const [dams, setDams]             = useState<Dam[]>([])
  const [searching, setSearching]   = useState(false)
  const [recentDams, setRecentDams] = useState<Dam[]>([])
  const [calf, setCalf]             = useState(blankCalfState())
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [session, setSession]       = useState<CalfRecord[]>([])
  const [sireBreed, setSireBreed]   = useState<string | null>(null)
  const submittingRef               = useRef(false)

  // Load recent cows/heifers on mount
  useEffect(() => {
    apiGet('/api/animals?sex=cow,heifer&limit=10&status=active')
      .then(r => r.json())
      .then(d => setRecentDams(d.data ?? []))
      .catch(() => {})
  }, [])

  // Preview breed whenever dam or sire changes
  useEffect(() => {
    const damBreeds = getDamBreeds(dam)
    const sireBreeds = getSireBreeds(sireBreed)
    console.log('[BREED DEBUG] preview — dam:', dam?.id ?? 'none', 'sireBreed:', sireBreed)
    console.log('[BREED DEBUG] damBreeds:', JSON.stringify(damBreeds), 'sireBreeds:', JSON.stringify(sireBreeds))
    console.log('[breed TRIGGER] dam:', dam?.tag_number, 'breeds:', JSON.stringify(dam?.breeds), 'breed:', dam?.breed)
    console.log('[breed TRIGGER] sire source:', calf.sireKnown ? (calf.sireLibraryId ? 'library' : calf.sireId ? 'herd' : 'name-only') : 'unknown')
    console.log('[breed TRIGGER] sireBreed:', sireBreed)
    if (damBreeds.length > 0 || sireBreeds.length > 0) {
      const preview = calf.sireKnown ? calcCalfBreeds(damBreeds, sireBreeds) : damBreeds
      console.log('[BREED DEBUG] preview result:', JSON.stringify(preview))
      console.log('[breed TRIGGER] calcCalfBreeds result:', JSON.stringify(preview))
    }
  }, [dam, sireBreed, calf.sireKnown])

  const searchDams = async (q: string) => {
    setSearch(q)
    if (!q.trim()) { setDams([]); return }
    setSearching(true)
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(q)}&sex=cow,heifer&limit=10`)
      const data = await res.json()
      setDams(data.data ?? [])
    } finally {
      setSearching(false)
    }
  }

  const selectDam = (d: Dam) => {
    console.log('[BREED DEBUG] dam selected:', d.id, 'tag:', d.tag_number, 'breed:', d.breed, 'breeds:', JSON.stringify(d.breeds))
    setDam(d)
    setSearch('')
    setDams([])
    setTimeout(() => tagRef.current?.focus(), 100)
  }

  const updateCalf = <K extends keyof ReturnType<typeof blankCalfState>>(
    key: K,
    val: ReturnType<typeof blankCalfState>[K]
  ) => {
    setCalf(prev => ({ ...prev, [key]: val }))
  }

  const doSave = async () => {
    if (submittingRef.current) return
    if (!dam) { setError('Select a dam first'); return }
    if (!calf.calfTag.trim()) { setError('Calf tag number is required'); return }
    submittingRef.current = true
    setSaving(true)
    setError('')

    const damBreeds  = getDamBreeds(dam)
    const sireBreeds = getSireBreeds(sireBreed)
    console.log('[BREED DEBUG] doSave — damBreeds:', JSON.stringify(damBreeds), 'sireBreeds:', JSON.stringify(sireBreeds))
    console.log('[breed TRIGGER] dam:', dam?.tag_number, 'breeds:', JSON.stringify(dam?.breeds), 'breed:', dam?.breed)
    console.log('[breed TRIGGER] sire source:', calf.sireKnown ? (calf.sireLibraryId ? 'library' : calf.sireId ? 'herd' : 'name-only') : 'unknown')
    console.log('[breed TRIGGER] sireBreed:', sireBreed)
    const autoBreeds = calf.sireKnown
      ? calcCalfBreeds(damBreeds, sireBreeds)
      : damBreeds.map(b => ({ breed: b.breed, pct: b.pct }))
    console.log('[breed TRIGGER] calcCalfBreeds result:', JSON.stringify(autoBreeds))
    console.log('[breed TRIGGER] setting calf_data.breeds to:', JSON.stringify(autoBreeds))
    console.log('[BREED DEBUG] doSave — autoBreeds applied:', JSON.stringify(autoBreeds))

    try {
      const submitPayload = {
        tag_number:      calf.calfTag.trim(),
        ear_tag_color:   calf.calfColor,
        breeds:          autoBreeds,
        sire_id:         calf.sireKnown ? calf.sireId : null,
        sire_library_id: calf.sireKnown ? calf.sireLibraryId : null,
      }
      console.log('[calving FORM] submitting calf_data:', JSON.stringify(submitPayload, null, 2))

      const res = await apiPost('/api/reproduction', {
          animal_id:          dam.id,
          event_type:         'calved',
          event_date:         calf.calfDob,
          calving_ease_score: Number(calf.calveEase),
          create_calf:        true,
          calf_data: {
            tag_number:             calf.calfTag.trim(),
            ear_tag_color:          calf.calfColor,
            sex:                    'calf',
            calf_sex:               calf.calfSex === 'calf' ? null : calf.calfSex,
            dob:                    calf.calfDob,
            birth_weight_lbs:       calf.calfWeight ? Number(calf.calfWeight) : null,
            birth_weight_estimated: calf.calfEstWeight,
            breeds:                 autoBreeds,
            birth_type:             calf.birthType,
            vigor_score:            Number(calf.vigor),
            conception_method:      calf.conception,
            sire_id:                calf.sireKnown ? calf.sireId : null,
            sire_library_id:        calf.sireKnown ? calf.sireLibraryId : null,
            sire_name_text:         calf.sireKnown ? calf.sireName : null,
            donor_dam_id:           null,
            notes:                  calf.calfNotes || null,
          },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }

      const savedTag = calf.calfTag.trim()
      const savedId  = data.calf?.id ?? ''
      setSession(prev => [{ tag_number: savedTag, sex: calf.calfSex, dam_tag: dam.tag_number, id: savedId }, ...prev])
      setSuccessMsg(`✓ Calf #${savedTag} created and linked to dam #${dam.tag_number}`)
      setTimeout(() => setSuccessMsg(''), 3000)
      return { dam }
    } catch {
      setError('Connection error — please try again')
      return null
    } finally {
      setSaving(false)
      submittingRef.current = false
    }
  }

  const clearCalf = () => { setCalf(blankCalfState()); setSireBreed(null) }

  const handleSaveAndNext = async () => {
    const result = await doSave()
    if (result) { clearCalf(); setTimeout(() => tagRef.current?.focus(), 100) }
  }

  const handleSaveAndNewDam = async () => {
    const result = await doSave()
    if (result) { clearCalf(); setDam(null); setSearch('') }
  }

  const handleSaveAndDone = async () => {
    const result = await doSave()
    if (result) router.push('/reproduction')
  }

  const displayDams = search ? dams : recentDams

  return (
    <PageContainer>
      <PageHeader
        eyebrow="REPRODUCTION"
        title="CALVING ENTRY"
        subtitle={`${session.length} calf${session.length !== 1 ? 's' : ''} recorded this session`}
        actions={<ButtonLink href="/reproduction" intent="ghost" size="sm">← Back</ButtonLink>}
      />

      {successMsg && (
        <div className="mb-4">
          <ContextBanner tone="success">{successMsg}</ContextBanner>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-5">
        {/* ── LEFT: Dam selection ───────────────────────── */}
        <div className="md:w-72 flex-shrink-0">
          <Panel title="SELECT DAM">
            {dam ? (
              <div className="flex flex-col gap-2">
                <ContextBanner tone="success" eyebrow="DAM SELECTED">
                  <div className="flex items-center gap-2">
                    <EarTagDot color={dam.ear_tag_color} size="md" />
                    <span className="font-semibold">#{dam.tag_number}{dam.name ? ` — ${dam.name}` : ''}</span>
                  </div>
                  {dam.breed && <p className="type-helper" style={{ color: 'var(--success-fg)' }}>{dam.breed}</p>}
                </ContextBanner>
                <button
                  type="button"
                  className="type-helper text-center"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => setDam(null)}
                >
                  Change dam
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <SearchField
                  value={search}
                  onChange={e => searchDams(e.target.value)}
                  placeholder="Search by tag or name…"
                  autoFocus
                />
                {searching && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
                {!search && recentDams.length > 0 && (
                  <p className="type-field-label mt-1" style={{ color: 'var(--text-muted)' }}>Recent cows &amp; heifers</p>
                )}
                <div className="flex flex-col gap-0.5">
                  {displayDams.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => selectDam(d)}
                      className="w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] transition-colors"
                      style={{ border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <div className="flex items-center gap-2">
                        <EarTagDot color={d.ear_tag_color} size="md" />
                        <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{d.tag_number}</span>
                        {d.name && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{d.name}</span>}
                      </div>
                      {d.breed && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{d.breed}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Session summary */}
          {session.length > 0 && (
            <Panel title={`THIS SESSION — ${session.length} CALVES`} className="mt-4">
              <div className="flex flex-col gap-1.5">
                {session.map(c => (
                  <Link
                    key={c.id}
                    href={`/animals/${c.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] hover:opacity-80 transition-opacity"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{c.tag_number}</span>
                    <StatusChip map={SEX_CHIP} value={getSexValue(c.sex, (c as { calf_sex?: string | null }).calf_sex)} size="sm" />
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>← #{c.dam_tag}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ── RIGHT: Calf details ───────────────────────── */}
        <div className="flex-1 min-w-0">
          <Panel title="CALF DETAILS">
            {!dam ? (
              <p className="type-helper py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                Select a dam to enter calf details
              </p>
            ) : (
              <div className="flex flex-col gap-4 pt-1">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tag number" required>
                    <input
                      ref={tagRef}
                      type="text"
                      value={calf.calfTag}
                      onChange={e => updateCalf('calfTag', e.target.value)}
                      placeholder="e.g. 2401"
                      className="font-mono w-full rounded-[var(--radius-md)] px-3 h-10 type-data-sm"
                      style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </Field>
                  <Field label="Birth date" required>
                    <Input type="date" value={calf.calfDob} onChange={e => updateCalf('calfDob', e.target.value)} />
                  </Field>
                </div>

                <Field label="Ear tag color">
                  <EarTagColorPicker value={calf.calfColor} onChange={v => updateCalf('calfColor', v ? normalizeColor(v) : null)} />
                </Field>

                <Field label="Sex" required>
                  <SegmentedControl
                    value={calf.calfSex}
                    onChange={v => updateCalf('calfSex', v as CalfSex)}
                    items={CALF_SEX_ITEMS}
                    block size="sm"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Birth weight (lbs)">
                    <Input
                      type="number" step="0.1" min="0"
                      value={calf.calfWeight}
                      onChange={e => updateCalf('calfWeight', e.target.value)}
                      placeholder="e.g. 85"
                    />
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                      <input type="checkbox" checked={calf.calfEstWeight} onChange={e => updateCalf('calfEstWeight', e.target.checked)} className="rounded" />
                      <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Estimated</span>
                    </label>
                  </Field>
                  <Field label="Calving ease">
                    <SegmentedControl value={calf.calveEase} onChange={v => updateCalf('calveEase', v)} items={EASE_ITEMS} block size="sm" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Birth type">
                    <SegmentedControl value={calf.birthType} onChange={v => updateCalf('birthType', v as BirthType)} items={BIRTH_TYPE_ITEMS} block size="sm" />
                  </Field>
                  <Field label="Vigor">
                    <SegmentedControl value={calf.vigor} onChange={v => updateCalf('vigor', v)} items={VIGOR_ITEMS} block size="sm" />
                  </Field>
                </div>

                <Field label="Conception method">
                  <SegmentedControl value={calf.conception} onChange={v => updateCalf('conception', v as ConceptionMethod)} items={CONCEPTION_ITEMS} block size="sm" />
                </Field>

                <div>
                  <label className="flex items-center gap-2 mb-3 cursor-pointer">
                    <input type="checkbox" checked={calf.sireKnown} onChange={e => updateCalf('sireKnown', e.target.checked)} className="rounded" />
                    <span className="type-field-label">Sire known?</span>
                  </label>
                  {calf.sireKnown && (
                    <SireSelector
                      sireId={calf.sireId}
                      sireName={calf.sireName}
                      sireLibraryId={calf.sireLibraryId}
                      onChangeSireId={v => updateCalf('sireId', v)}
                      onChangeSireName={v => updateCalf('sireName', v)}
                      onChangeSireLibraryId={v => updateCalf('sireLibraryId', v)}
                      onChangeSireBreed={setSireBreed}
                    />
                  )}
                </div>

                {/* Breed preview */}
                {dam && (dam.breed || (dam.breeds && dam.breeds.length > 0)) && (
                  <ContextBanner tone="info" eyebrow="ESTIMATED BREED">
                    {(() => {
                      const damB: BreedEntry[] = dam.breeds?.length ? dam.breeds : dam.breed ? [{ breed: dam.breed, pct: 100 }] : []
                      const sireB: BreedEntry[] = sireBreed ? [{ breed: sireBreed, pct: 100 }] : []
                      const calc = calf.sireKnown ? calcCalfBreeds(damB, sireB) : damB
                      return calc.map((b, i) => (
                        <span key={b.breed}>{i > 0 ? ' / ' : ''}{b.pct < 100 ? `${b.pct}% ` : ''}{b.breed}</span>
                      ))
                    })()}
                  </ContextBanner>
                )}

                <Field label="Notes">
                  <Textarea value={calf.calfNotes} onChange={e => updateCalf('calfNotes', e.target.value)} rows={2} placeholder="Observations…" />
                </Field>

                {error && (
                  <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
                    style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                    {error}
                  </p>
                )}

                {/* Action bar */}
                <div
                  className="flex flex-col sm:flex-row gap-2 pt-2 sticky bottom-0 pb-4"
                  style={{ backgroundColor: 'var(--surface-1)' }}
                >
                  <Button type="button" intent="primary" loading={saving} onClick={handleSaveAndNext} block>
                    SAVE &amp; ENTER NEXT
                  </Button>
                  <Button type="button" intent="secondary" loading={saving} onClick={handleSaveAndNewDam}>
                    SAVE &amp; NEW DAM
                  </Button>
                  <Button type="button" intent="ghost" loading={saving} onClick={handleSaveAndDone}>
                    SAVE &amp; DONE
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  )
}
