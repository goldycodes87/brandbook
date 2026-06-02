'use client'

import { useState, useEffect } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Field, Input, Select, Textarea, SearchField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ActionFooter } from '@/components/ui/ActionFooter'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Panel } from '@/components/ui/Panel'
import { SireSelector } from '@/components/reproduction/SireSelector'
import { EarTagColorPicker } from '@/components/reproduction/EarTagColorPicker'
import type { SegmentItem } from '@/components/ui/SegmentedControl'
import { apiGet, apiPost } from '@/lib/fetch'
import { calcCalfBreeds, type BreedEntry } from '@/lib/breed-calculator'

type EventType = 'bred' | 'preg_check' | 'calved' | 'weaned' | 'flushed' | 'bse' | 'semen_collection'
type ConceptionMethod = 'natural' | 'ai' | 'embryo'
type PregCheckResult = 'confirmed' | 'open' | 'recheck'
type CalfSex = 'heifer_calf' | 'bull_calf' | 'calf'
type BirthType = 'single' | 'twin_a' | 'twin_b'

const COW_EVENTS: SegmentItem<EventType>[] = [
  { value: 'bred',       label: 'BRED' },
  { value: 'preg_check', label: 'PREG CHECK' },
  { value: 'calved',     label: 'CALVED' },
  { value: 'weaned',     label: 'WEANED' },
  { value: 'flushed',    label: 'FLUSHED' },
]
const BULL_EVENTS: SegmentItem<EventType>[] = [
  { value: 'bse',              label: 'BSE' },
  { value: 'semen_collection', label: 'SEMEN COLL.' },
]

const CONCEPTION_ITEMS: SegmentItem<ConceptionMethod>[] = [
  { value: 'natural', label: 'NATURAL' },
  { value: 'ai',      label: 'AI' },
  { value: 'embryo',  label: 'EMBRYO' },
]

const PREG_RESULT_ITEMS: SegmentItem<PregCheckResult>[] = [
  { value: 'confirmed', label: 'CONFIRMED' },
  { value: 'open',      label: 'OPEN' },
  { value: 'recheck',   label: 'RECHECK' },
]

const CALF_SEX_ITEMS: SegmentItem<CalfSex>[] = [
  { value: 'heifer_calf', label: 'HEIFER CALF' },
  { value: 'bull_calf',   label: 'BULL CALF' },
  { value: 'calf',        label: 'UNKNOWN' },
]

const BIRTH_TYPE_ITEMS: SegmentItem<BirthType>[] = [
  { value: 'single',  label: 'SINGLE' },
  { value: 'twin_a',  label: 'TWIN A' },
  { value: 'twin_b',  label: 'TWIN B' },
]

const EASE_ITEMS: SegmentItem<string>[] = [
  { value: '1', label: '1 UNAIDED' },
  { value: '2', label: '2 EASY PULL' },
  { value: '3', label: '3 HARD PULL' },
  { value: '4', label: '4 MALP.' },
  { value: '5', label: '5 C-SECTION' },
]

const VIGOR_ITEMS: SegmentItem<string>[] = [
  { value: '1', label: '1 WEAK' },
  { value: '2', label: '2 NORMAL' },
  { value: '3', label: '3 STRONG' },
]

const normalizeColor = (c: string | null) =>
  c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : null

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDateLong(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface DamRef {
  id: string
  tag_number: string
  name: string | null
}

export interface ReproEventFormProps {
  animalId: string
  animalSex: string
  animalRef?: DamRef
  defaultEventType?: EventType
  onSuccess: (result: Record<string, unknown>) => void
  onCancel: () => void
}

export function ReproEventForm({
  animalId,
  animalSex,
  animalRef,
  defaultEventType,
  onSuccess,
  onCancel,
}: ReproEventFormProps) {
  const isBull    = animalSex === 'bull'
  const defaultEt = defaultEventType ?? (isBull ? 'bse' : 'bred')

  const [eventType,        setEventType]        = useState<EventType>(defaultEt)
  const [eventDate,        setEventDate]        = useState(new Date().toISOString().slice(0, 10))
  const [conceptionMethod, setConceptionMethod] = useState<ConceptionMethod>('natural')
  const [sireId,           setSireId]           = useState<string | null>(null)
  const [sireName,         setSireName]         = useState<string | null>(null)
  const [sireLibraryId,    setSireLibraryId]    = useState<string | null>(null)
  const [aiTech,           setAiTech]           = useState('')
  const [pregResult,       setPregResult]       = useState<PregCheckResult>('confirmed')
  const [pregMethod,       setPregMethod]       = useState('ultrasound')
  const [daysBred,         setDaysBred]         = useState('')
  const [calveEase,        setCalveEase]        = useState('1')
  const [weanWeight,       setWeanWeight]       = useState('')
  const [weanedCalfId,     setWeanedCalfId]     = useState<string | null>(null)
  const [weanedCalfTag,    setWeanedCalfTag]    = useState('')
  const [weanCalfSearch,   setWeanCalfSearch]   = useState('')
  const [weanCalfResults,  setWeanCalfResults]  = useState<{ id: string; tag_number: string; name: string | null }[]>([])
  const [weanCalfSearching, setWeanCalfSearching] = useState(false)
  const [notes,            setNotes]            = useState('')
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')

  // Calf fields
  const [calfTag,        setCalfTag]        = useState('')
  const [calfColor,      setCalfColor]      = useState<string | null>(null)
  const [calfSex,        setCalfSex]        = useState<CalfSex>('heifer_calf')
  const [calfDob,        setCalfDob]        = useState(new Date().toISOString().slice(0, 10))
  const [calfWeight,     setCalfWeight]     = useState('')
  const [calfEstWeight,  setCalfEstWeight]  = useState(true)
  const [birthType,      setBirthType]      = useState<BirthType>('single')
  const [vigor,          setVigor]          = useState('2')
  const [calfConception, setCalfConception] = useState<ConceptionMethod>('natural')
  const [calfSireId,        setCalfSireId]        = useState<string | null>(null)
  const [calfSireName,      setCalfSireName]      = useState<string | null>(null)
  const [calfSireLibraryId, setCalfSireLibraryId] = useState<string | null>(null)
  const [calfSireBreeds,    setCalfSireBreeds]    = useState<BreedEntry[]>([])
  const [calfSireKnown,     setCalfSireKnown]     = useState(true)
  const [calfBreeds,        setCalfBreeds]        = useState<BreedEntry[]>([])
  const [damBreeds,         setDamBreeds]         = useState<BreedEntry[]>([])
  const [calfNotes,         setCalfNotes]         = useState('')

  // Fetch dam breeds for calf breed calculation
  useEffect(() => {
    apiGet(`/api/animals/${animalId}`).then(r => r.json()).then(d => {
      if (d.breeds?.length) setDamBreeds(d.breeds)
      else if (d.breed) setDamBreeds([{ breed: d.breed, pct: 100 }])
    }).catch(() => {})
  }, [animalId])

  // Recalculate calf breeds when dam or sire changes
  useEffect(() => {
    if (!damBreeds.length && !calfSireBreeds.length) { setCalfBreeds([]); return }
    setCalfBreeds(calcCalfBreeds(damBreeds, calfSireBreeds))
  }, [damBreeds, calfSireBreeds])

  // Flushed fields
  const [embryosRecovered, setEmbryosRecovered] = useState('')
  const [grade1, setGrade1] = useState(''); const [grade2, setGrade2] = useState('')
  const [grade3, setGrade3] = useState(''); const [grade4, setGrade4] = useState('')
  const [degenerate, setDegenerate] = useState('')
  const [frozen, setFrozen] = useState(''); const [transferred, setTransferred] = useState('')
  const [flushTech, setFlushTech] = useState('')

  // Expected calving calc for bred events
  const estCalving = eventDate && eventType === 'bred' ? addDays(eventDate, 283) : null
  // Days bred → est calving for preg check
  const pregEstCalving = daysBred && eventDate ? addDays(eventDate, -(Number(daysBred)) + 283) : null

  const searchWeanCalves = async (q: string) => {
    setWeanCalfSearch(q)
    if (!q.trim()) { setWeanCalfResults([]); return }
    setWeanCalfSearching(true)
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setWeanCalfResults(data.data ?? [])
    } finally {
      setWeanCalfSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (eventType === 'calved' && !calfTag.trim()) {
      setError('Calf tag number is required')
      return
    }

    setSaving(true)
    try {
      let payload: Record<string, unknown> = {
        animal_id:  animalId,
        event_type: eventType,
        event_date: eventDate,
        notes:      notes || null,
      }

      if (eventType === 'bred') {
        payload = {
          ...payload,
          sire_id:            sireId,
          sire_name_text:     sireName,
          sire_library_id:    sireLibraryId,
          conception_method:  conceptionMethod,
          ai_technician:      conceptionMethod === 'ai' ? aiTech || null : null,
        }
      }

      if (eventType === 'preg_check') {
        payload = {
          ...payload,
          preg_check_result:  pregResult,
          preg_check_method:  pregMethod,
          days_bred:          daysBred ? Number(daysBred) : null,
        }
      }

      if (eventType === 'calved') {
        payload = {
          ...payload,
          calving_ease_score: Number(calveEase),
          create_calf: true,
          calf_data: {
            tag_number:              calfTag.trim(),
            ear_tag_color:           calfColor,
            sex:                     'calf',
            calf_sex:                calfSex === 'calf' ? null : calfSex,
            dob:                     calfDob,
            birth_weight_lbs:        calfWeight ? Number(calfWeight) : null,
            birth_weight_estimated:  calfEstWeight,
            birth_type:              birthType,
            vigor_score:             Number(vigor),
            conception_method:       calfConception,
            sire_id:                 calfSireKnown ? calfSireId : null,
            sire_name_text:          calfSireKnown ? calfSireName : null,
            sire_library_id:         calfSireKnown ? calfSireLibraryId : null,
            breeds:                  calfBreeds,
            donor_dam_id:            null,
            notes:                   calfNotes || null,
          },
        }
      }

      if (eventType === 'weaned') {
        payload = {
          ...payload,
          weaning_date:       eventDate,
          weaning_weight_lbs: weanWeight ? Number(weanWeight) : null,
          weaned_calf_id:     weanedCalfId ?? null,
        }
      }

      if (eventType === 'flushed') {
        payload = {
          ...payload,
          notes: [
            `Embryos: ${embryosRecovered || 0}`,
            grade1 ? `G1: ${grade1}` : '',
            grade2 ? `G2: ${grade2}` : '',
            grade3 ? `G3: ${grade3}` : '',
            grade4 ? `G4: ${grade4}` : '',
            degenerate ? `Degen: ${degenerate}` : '',
            frozen ? `Frozen: ${frozen}` : '',
            transferred ? `Transferred: ${transferred}` : '',
            flushTech ? `Tech: ${flushTech}` : '',
            notes ? notes : '',
          ].filter(Boolean).join(' | '),
          ai_technician: flushTech || null,
        }
      }

      const res  = await apiPost('/api/reproduction', payload)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess(json)
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const eventItems = isBull ? BULL_EVENTS : COW_EVENTS

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Event type">
        <SegmentedControl
          value={eventType}
          onChange={v => setEventType(v as EventType)}
          items={eventItems}
          block
          size="sm"
        />
      </Field>

      <Field label="Date" required>
        <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
      </Field>

      {/* ── BRED ─────────────────────────────────────────── */}
      {eventType === 'bred' && (
        <>
          <Field label="Conception method">
            <SegmentedControl
              value={conceptionMethod}
              onChange={v => setConceptionMethod(v as ConceptionMethod)}
              items={CONCEPTION_ITEMS}
              block size="sm"
            />
          </Field>

          <Field label="Sire">
            <SireSelector
              sireId={sireId}
              sireName={sireName}
              sireLibraryId={sireLibraryId}
              onChangeSireId={setSireId}
              onChangeSireName={setSireName}
              onChangeSireLibraryId={setSireLibraryId}
            />
          </Field>

          {conceptionMethod === 'ai' && (
            <Field label="AI technician">
              <Input value={aiTech} onChange={e => setAiTech(e.target.value)} placeholder="Name or company" />
            </Field>
          )}

          {estCalving && (
            <ContextBanner tone="info" eyebrow="GESTATION ESTIMATE">
              Expected calving: <strong>{fmtDateLong(estCalving)}</strong>
              <span className="block type-helper mt-0.5" style={{ color: 'var(--info-fg)' }}>Based on 283-day gestation</span>
            </ContextBanner>
          )}
        </>
      )}

      {/* ── PREG CHECK ───────────────────────────────────── */}
      {eventType === 'preg_check' && (
        <>
          <Field label="Result">
            <SegmentedControl
              value={pregResult}
              onChange={v => setPregResult(v as PregCheckResult)}
              items={PREG_RESULT_ITEMS}
              block size="sm"
            />
          </Field>
          <Field label="Method">
            <Select value={pregMethod} onChange={e => setPregMethod(e.target.value)}>
              <option value="ultrasound">Ultrasound</option>
              <option value="manual">Manual / Rectal</option>
              <option value="blood_test">Blood Test</option>
            </Select>
          </Field>
          <Field label="Days bred" helper="Days since breeding (optional)">
            <Input type="number" min="0" value={daysBred} onChange={e => setDaysBred(e.target.value)} placeholder="e.g. 45" />
          </Field>
          {pregResult === 'confirmed' && pregEstCalving && (
            <ContextBanner tone="success" eyebrow="ESTIMATED CALVING">
              Expected: <strong>{fmtDateLong(pregEstCalving)}</strong>
            </ContextBanner>
          )}
        </>
      )}

      {/* ── CALVED ───────────────────────────────────────── */}
      {eventType === 'calved' && (
        <>
          <Field label="Calving ease score">
            <SegmentedControl
              value={calveEase}
              onChange={setCalveEase}
              items={EASE_ITEMS}
              block size="sm"
            />
          </Field>

          {animalRef && (
            <ContextBanner tone="info" eyebrow="WILL CREATE">
              A new calf record will be created and linked to dam{' '}
              <strong>#{animalRef.tag_number}{animalRef.name ? ` — ${animalRef.name}` : ''}</strong>
            </ContextBanner>
          )}

          <Panel title="CALF INFORMATION">
            <div className="flex flex-col gap-4 pt-1">
              <Field label="Tag number" required>
                <Input
                  value={calfTag}
                  onChange={e => setCalfTag(e.target.value)}
                  placeholder="e.g. 2401"
                  className="font-mono"
                  autoFocus
                />
              </Field>

              <Field label="Ear tag color">
                <EarTagColorPicker value={calfColor} onChange={v => setCalfColor(normalizeColor(v))} />
              </Field>

              <Field label="Sex" required>
                <SegmentedControl
                  value={calfSex}
                  onChange={v => setCalfSex(v as CalfSex)}
                  items={CALF_SEX_ITEMS}
                  block size="sm"
                />
              </Field>

              <Field label="Birth date" required>
                <Input type="date" value={calfDob} onChange={e => setCalfDob(e.target.value)} />
              </Field>

              <Field label="Birth weight (lbs)">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={calfWeight}
                  onChange={e => setCalfWeight(e.target.value)}
                  placeholder="e.g. 85"
                />
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calfEstWeight}
                    onChange={e => setCalfEstWeight(e.target.checked)}
                    className="rounded"
                  />
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Mark as estimated</span>
                </label>
              </Field>

              <Field label="Birth type">
                <SegmentedControl
                  value={birthType}
                  onChange={v => setBirthType(v as BirthType)}
                  items={BIRTH_TYPE_ITEMS}
                  block size="sm"
                />
              </Field>

              <Field label="Vigor score">
                <SegmentedControl
                  value={vigor}
                  onChange={setVigor}
                  items={VIGOR_ITEMS}
                  block size="sm"
                />
              </Field>

              <Field label="Conception method">
                <SegmentedControl
                  value={calfConception}
                  onChange={v => setCalfConception(v as ConceptionMethod)}
                  items={CONCEPTION_ITEMS}
                  block size="sm"
                />
              </Field>

              <div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calfSireKnown}
                    onChange={e => setCalfSireKnown(e.target.checked)}
                    className="rounded"
                  />
                  <span className="type-field-label">Sire known?</span>
                </label>
                {calfSireKnown && (
                  <SireSelector
                    sireId={calfSireId}
                    sireName={calfSireName}
                    sireLibraryId={calfSireLibraryId}
                    onChangeSireId={setCalfSireId}
                    onChangeSireName={setCalfSireName}
                    onChangeSireLibraryId={setCalfSireLibraryId}
                    onChangeSireBreed={breed => setCalfSireBreeds(breed ? [{ breed, pct: 100 }] : [])}
                    onClearSire={() => { setCalfSireLibraryId(null); setCalfSireBreeds([]) }}
                  />
                )}
              </div>

              <Field label="Calf notes">
                <Textarea value={calfNotes} onChange={e => setCalfNotes(e.target.value)} rows={2} placeholder="Observations…" />
              </Field>
            </div>
          </Panel>
        </>
      )}

      {/* ── WEANED ───────────────────────────────────────── */}
      {eventType === 'weaned' && (
        <>
          <Field label="Weaning weight (lbs)">
            <Input
              type="number"
              step="0.1"
              value={weanWeight}
              onChange={e => setWeanWeight(e.target.value)}
              placeholder="e.g. 550"
            />
          </Field>
          <Field label="Calf being weaned" helper="Optional — search by tag or name">
            {weanedCalfId ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)]"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{weanedCalfTag}</span>
                <button type="button" className="type-helper" style={{ color: 'var(--text-muted)' }}
                  onClick={() => { setWeanedCalfId(null); setWeanedCalfTag(''); setWeanCalfSearch(''); setWeanCalfResults([]) }}>
                  clear
                </button>
              </div>
            ) : (
              <>
                <SearchField
                  value={weanCalfSearch}
                  onChange={e => searchWeanCalves(e.target.value)}
                  placeholder="Search by tag or name…"
                />
                {weanCalfSearching && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
                {weanCalfResults.length > 0 && (
                  <div className="mt-1 rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {weanCalfResults.map(a => (
                      <button key={a.id} type="button"
                        className="w-full text-left px-3 py-2 transition-colors"
                        style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                        onClick={() => { setWeanedCalfId(a.id); setWeanedCalfTag(a.tag_number); setWeanCalfResults([]) }}>
                        <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{a.tag_number}</span>
                        {a.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>
        </>
      )}

      {/* ── FLUSHED ──────────────────────────────────────── */}
      {eventType === 'flushed' && (
        <>
          <Field label="Total embryos recovered">
            <Input type="number" min="0" value={embryosRecovered} onChange={e => setEmbryosRecovered(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            {[['Grade 1', grade1, setGrade1],
              ['Grade 2', grade2, setGrade2],
              ['Grade 3', grade3, setGrade3],
              ['Grade 4', grade4, setGrade4],
              ['Degenerate', degenerate, setDegenerate]].map(([label, val, setter]) => (
              <Field key={label as string} label={label as string}>
                <Input type="number" min="0" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frozen"><Input type="number" min="0" value={frozen} onChange={e => setFrozen(e.target.value)} /></Field>
            <Field label="Transferred"><Input type="number" min="0" value={transferred} onChange={e => setTransferred(e.target.value)} /></Field>
          </div>
          <Field label="Technician">
            <Input value={flushTech} onChange={e => setFlushTech(e.target.value)} />
          </Field>
        </>
      )}

      <Field label="Notes">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observations, comments…" />
      </Field>

      {error && (
        <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}

      <ActionFooter
        primary={<Button type="submit" intent="primary" loading={saving}>SAVE EVENT</Button>}
        secondary={<Button type="button" intent="ghost" onClick={onCancel}>CANCEL</Button>}
      />
    </form>
  )
}
