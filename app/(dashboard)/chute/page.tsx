'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Camera, ChevronRight, Undo2, CheckCircle } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '@/lib/fetch'
import { EarTagDot } from '@/components/ui/EarTagDot'

// ─── Tablet landscape detection ───────────────────────────────────────────────

function useTabletLandscape(): boolean {
  const [tl, setTl] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (orientation: landscape)')
    setTl(mq.matches)
    const h = (e: MediaQueryListEvent) => setTl(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return tl
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskType   = 'preg_check' | 'weight' | 'bred' | 'calved' | 'health'
type Screen     = 'setup' | 'animal' | 'tasks' | 'review' | 'summary'
type PregResult = 'confirmed' | 'open' | 'recheck'

interface AnimalLookup {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  ear_tag_color: string | null
}

interface SavedEvent   { type: TaskType; deleteUrl: string }
interface TaskResult   { task: TaskType; result: string; skipped: boolean }

interface ProcessedAnimal {
  animal: AnimalLookup
  taskResults: TaskResult[]
  savedEvents: SavedEvent[]
  error?: string
}

interface TaskData {
  preg_check?: { result: PregResult; method: string }
  weight?:     { weight_lbs: number }
  bred?:       { conception_method: 'natural' | 'ai' | 'embryo'; sire_name_text: string }
  calved?:     { calf_tag: string; calf_sex: 'heifer_calf' | 'bull_calf' | 'calf'; ease: number }
  health?:     { event_type: string; drug_name: string; dose_amount: string; dose_unit: string }
}

const TASK_LABELS: Record<TaskType, string> = {
  preg_check: 'Preg Check',
  weight:     'Weight',
  bred:       'Bred',
  calved:     'Calved',
  health:     'Health / Treatment',
}

const REPRO_TASKS: TaskType[] = ['preg_check', 'bred', 'calved']

function taskApplies(task: TaskType, sex: string | null): boolean {
  if (REPRO_TASKS.includes(task)) return sex === 'cow' || sex === 'heifer'
  return true
}

function getTaskSummary(task: TaskType, taskData: TaskData): string | null {
  if (task === 'preg_check' && taskData.preg_check) return taskData.preg_check.result.toUpperCase()
  if (task === 'weight'     && taskData.weight)     return `${taskData.weight.weight_lbs} lbs`
  if (task === 'bred'       && taskData.bred)       {
    const b = taskData.bred
    return b.sire_name_text ? `${b.conception_method.toUpperCase()} / ${b.sire_name_text}` : b.conception_method.toUpperCase()
  }
  if (task === 'calved'     && taskData.calved)     return `Calf #${taskData.calved.calf_tag || '—'}`
  if (task === 'health'     && taskData.health)     return taskData.health.drug_name || taskData.health.event_type
  return null
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({
  date, setDate, selectedTasks, setSelectedTasks, onStart, onExit, tl,
}: {
  date: string; setDate: (d: string) => void
  selectedTasks: TaskType[]; setSelectedTasks: (t: TaskType[]) => void
  onStart: () => void; onExit: () => void; tl: boolean
}) {
  const ALL: TaskType[] = ['preg_check', 'weight', 'bred', 'calved', 'health']
  const toggle = (t: TaskType) =>
    setSelectedTasks(selectedTasks.includes(t) ? selectedTasks.filter(x => x !== t) : [...selectedTasks, t])

  const TaskButton = ({ task }: { task: TaskType }) => {
    const on = selectedTasks.includes(task)
    return (
      <button
        onClick={() => toggle(task)}
        className="flex items-center justify-between px-4 rounded-[var(--radius-lg)] text-left transition-colors"
        style={{
          backgroundColor: on ? 'var(--accent-soft)' : 'var(--surface-1)',
          border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border)'}`,
          color: on ? 'var(--accent)' : 'var(--text)',
          minHeight: 56,
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <span className="type-body font-semibold">{TASK_LABELS[task]}</span>
        <div
          className="w-5 h-5 rounded flex items-center justify-center shrink-0 ml-2"
          style={{
            backgroundColor: on ? 'var(--accent)' : 'transparent',
            border: on ? 'none' : '2px solid var(--border-strong)',
          }}
        >
          {on && <span style={{ color: 'white', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      <div
        className="flex items-center justify-between px-4 h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <button onClick={onExit} style={{ color: 'var(--text-muted)' }}>
          <X size={22} />
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', color: 'var(--text)' }}>
          CHUTE MODE
        </span>
        <div style={{ width: 22 }} />
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tl ? (
          /* Tablet landscape: date left, 3-col task grid right */
          <div className="flex gap-8 h-full">
            <div className="w-56 shrink-0">
              <p className="type-section-label mb-2">SESSION DATE</p>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
                style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
            <div className="flex-1">
              <p className="type-section-label mb-3">TASKS TO RUN</p>
              <div className="grid grid-cols-3 gap-3">
                {ALL.map(task => <TaskButton key={task} task={task} />)}
              </div>
            </div>
          </div>
        ) : (
          /* Mobile: stacked */
          <div className="flex flex-col gap-6">
            <div>
              <p className="type-section-label mb-2">SESSION DATE</p>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
                style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
            <div>
              <p className="type-section-label mb-3">TASKS TO RUN</p>
              <div className="flex flex-col gap-2">
                {ALL.map(task => <TaskButton key={task} task={task} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 pb-10 shrink-0">
        <button
          onClick={onStart}
          disabled={selectedTasks.length === 0}
          className="w-full rounded-[var(--radius-lg)] type-body font-bold tracking-widest disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--accent)', color: 'white', fontSize: '1rem', minHeight: 56 }}
        >
          START SESSION
        </button>
      </div>
    </div>
  )
}

// ─── Animal ID Screen ─────────────────────────────────────────────────────────

function AnimalScreen({
  processed, onAnimalLoaded, onDone, onExit, tl,
}: {
  processed: ProcessedAnimal[]
  onAnimalLoaded: (a: AnimalLookup) => void
  onDone: () => void
  onExit: () => void
  tl: boolean
}) {
  const [tagInput, setTagInput] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const lookup = async (tag: string) => {
    const t = tag.trim()
    if (!t) return
    setLoading(true); setError('')
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(t)}&limit=5`)
      const json = await res.json()
      const animals: AnimalLookup[] = json.data ?? []
      const exact = animals.find(a => a.tag_number.toLowerCase() === t.toLowerCase())
      const match = exact ?? animals[0]
      if (!match) { setError(`No animal found with tag #${t}`); return }
      setTagInput('')
      onAnimalLoaded(match)
    } catch {
      setError('Connection error — try again')
    } finally {
      setLoading(false)
    }
  }

  const handleScan = (file: File) => {
    setScanning(true); setError('')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string
        const base64  = dataUrl.split(',')[1]
        const mimeMatch = dataUrl.match(/data:([^;]+);/)
        const media_type = mimeMatch?.[1] ?? 'image/jpeg'
        const res  = await apiPost('/api/ai/read-tag', { image_base64: base64, media_type })
        const json = await res.json()
        if (json.tag_number) setTagInput(json.tag_number)
        else setError("Couldn't read tag clearly — enter manually")
      } catch {
        setError('Camera read failed — enter manually')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  /* Recent animal tiles: compact squares */
  const tileCount = tl ? 16 : 9
  const recent = [...processed].reverse().slice(0, tileCount)

  const RecentGrid = () => (
    <div className={tl ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-3 gap-2'}>
      {recent.map(p => (
        <div
          key={p.animal.id}
          className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)]"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border)',
            minHeight: tl ? 80 : 64,
            padding: tl ? '12px 8px' : '8px 4px',
          }}
        >
          <EarTagDot color={p.animal.ear_tag_color} size="sm" />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--accent)',
            fontSize: tl ? '0.9rem' : '0.75rem',
            textAlign: 'center',
            wordBreak: 'break-all',
          }}>
            #{p.animal.tag_number}
          </span>
          <CheckCircle size={tl ? 14 : 12} style={{ color: 'var(--success-fg)' }} />
        </div>
      ))}
    </div>
  )

  const EntryForm = () => (
    <div
      className="rounded-[var(--radius-xl)] p-5 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <p className="type-section-label">SCAN OR ENTER TAG</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="w-full rounded-[var(--radius-lg)] flex items-center justify-center gap-2 type-body font-semibold transition-opacity disabled:opacity-50"
        style={{
          backgroundColor: 'var(--surface-3)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          minHeight: 56,
        }}
      >
        <Camera size={22} />
        {scanning ? 'Reading tag…' : 'PHOTO SCAN'}
      </button>
      <div className="flex gap-2">
        <input
          type="text"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup(tagInput)}
          placeholder="Tag #"
          className="flex-1 px-4 rounded-[var(--radius-lg)] text-center font-mono"
          style={{
            backgroundColor: 'var(--surface-0)',
            border: '2px solid var(--border-strong)',
            color: 'var(--text)',
            fontSize: '2rem',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            minHeight: 56,
          }}
          autoFocus
          inputMode="text"
        />
        <button
          onClick={() => lookup(tagInput)}
          disabled={loading || !tagInput.trim()}
          className="px-4 rounded-[var(--radius-lg)] font-bold disabled:opacity-40 flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent)', color: 'white', minWidth: 56 }}
        >
          {loading ? '…' : <ChevronRight size={24} />}
        </button>
      </div>
      {error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <button onClick={onExit} style={{ color: 'var(--text-muted)' }}>
          <X size={22} />
        </button>
        <div className="flex items-center gap-3">
          {processed.length > 0 && (
            <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>
              {processed.length} done
            </span>
          )}
          {processed.length > 0 && (
            <button
              onClick={onDone}
              className="px-3 rounded-[var(--radius-md)] type-data-sm font-bold"
              style={{ backgroundColor: 'var(--accent)', color: 'white', minHeight: 32 }}
            >
              DONE
            </button>
          )}
        </div>
      </div>

      {tl ? (
        /* Tablet: side-by-side — entry left, recent right */
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-5 overflow-y-auto border-r" style={{ borderColor: 'var(--border)' }}>
            <EntryForm />
          </div>
          {processed.length > 0 && (
            <div className="flex-1 p-5 overflow-y-auto">
              <p className="type-section-label mb-3">DONE THIS SESSION</p>
              <RecentGrid />
            </div>
          )}
        </div>
      ) : (
        /* Mobile: stacked */
        <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">
          <EntryForm />
          {processed.length > 0 && (
            <div>
              <p className="type-section-label mb-2">DONE THIS SESSION</p>
              <RecentGrid />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Task: Preg Check ─────────────────────────────────────────────────────────

function PregCheckTask({ value, onChange }: {
  value: TaskData['preg_check']
  onChange: (v: TaskData['preg_check']) => void
}) {
  const result = value?.result ?? null
  const method = value?.method ?? 'ultrasound'
  const setResult = (r: PregResult) => onChange({ result: r, method })
  const setMethod = (m: string)     => onChange({ result: result ?? 'confirmed', method: m })

  const TILES = [
    { key: 'confirmed' as PregResult, label: 'CONFIRMED', bg: 'var(--success-bg)', border: 'var(--success-border)', fg: 'var(--success-fg)' },
    { key: 'open'      as PregResult, label: 'OPEN',      bg: 'var(--warning-bg)', border: 'var(--warning-border)', fg: 'var(--warning-fg)' },
    { key: 'recheck'   as PregResult, label: 'RECHECK',   bg: 'var(--info-bg)',    border: 'var(--info-border)',    fg: 'var(--info-fg)' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        {TILES.map(t => (
          <button
            key={t.key}
            onClick={() => setResult(t.key)}
            className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] gap-2 transition-all"
            style={{
              backgroundColor: result === t.key ? t.bg : 'var(--surface-1)',
              border: `2px solid ${result === t.key ? t.border : 'var(--border)'}`,
              color: result === t.key ? t.fg : 'var(--text-muted)',
              minHeight: 80,
            }}
          >
            {result === t.key && <CheckCircle size={18} />}
            <span className="type-data-sm font-bold" style={{ fontSize: '0.7rem' }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="type-section-label mb-2">METHOD</p>
        <div className="flex gap-2">
          {[['ultrasound', 'ULTRASOUND'], ['manual', 'RECTAL'], ['blood_test', 'BLOOD']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setMethod(val)}
              className="flex-1 rounded-[var(--radius-md)] type-data-sm font-semibold"
              style={{
                backgroundColor: method === val ? 'var(--accent-soft)' : 'var(--surface-1)',
                border: `1px solid ${method === val ? 'var(--accent-border)' : 'var(--border)'}`,
                color: method === val ? 'var(--accent)' : 'var(--text-muted)',
                minHeight: 44,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Task: Weight ─────────────────────────────────────────────────────────────

function WeightTask({ value, onChange }: {
  value: TaskData['weight']
  onChange: (v: TaskData['weight']) => void
}) {
  const lbs = value?.weight_lbs?.toString() ?? ''
  const setLbs = (s: string) => {
    const n = parseFloat(s)
    onChange(s && !isNaN(n) && n > 0 ? { weight_lbs: n } : undefined)
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="flex items-end gap-2">
        <input
          type="number"
          value={lbs}
          onChange={e => setLbs(e.target.value)}
          placeholder="0"
          style={{
            fontSize: '4.5rem', fontWeight: 700, fontFamily: 'var(--font-display)',
            color: 'var(--text)', backgroundColor: 'transparent', border: 'none',
            width: 220, outline: 'none', textAlign: 'center',
          }}
          inputMode="decimal"
          autoFocus
        />
        <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>lbs</span>
      </div>
    </div>
  )
}

// ─── Task: Bred ───────────────────────────────────────────────────────────────

function BredTask({ value, onChange, tl }: {
  value: TaskData['bred']
  onChange: (v: TaskData['bred'] | undefined) => void
  tl: boolean
}) {
  const method = value?.conception_method ?? 'natural'
  const sire   = value?.sire_name_text ?? ''
  const set = (patch: Partial<NonNullable<TaskData['bred']>>) =>
    onChange({ conception_method: method, sire_name_text: sire, ...patch })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="type-section-label mb-3">CONCEPTION METHOD</p>
        {/* Mobile: 2-col (NATURAL+AI top, EMBRYO bottom); Tablet: 3-col */}
        <div className={tl ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
          {(['natural', 'ai', 'embryo'] as const).map(m => (
            <button
              key={m}
              onClick={() => set({ conception_method: m })}
              className="rounded-[var(--radius-lg)] type-data-sm font-bold"
              style={{
                backgroundColor: method === m ? 'var(--accent-soft)' : 'var(--surface-1)',
                border: `2px solid ${method === m ? 'var(--accent-border)' : 'var(--border)'}`,
                color: method === m ? 'var(--accent)' : 'var(--text-muted)',
                minHeight: 56,
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="type-section-label mb-2">SIRE (OPTIONAL)</p>
        <input
          type="text"
          value={sire}
          onChange={e => set({ sire_name_text: e.target.value })}
          placeholder="Bull name or tag #"
          className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 56 }}
        />
      </div>
    </div>
  )
}

// ─── Task: Calved ─────────────────────────────────────────────────────────────

function CalvedTask({ value, onChange }: {
  value: TaskData['calved']
  onChange: (v: TaskData['calved']) => void
}) {
  const calfTag = value?.calf_tag ?? ''
  const calfSex = value?.calf_sex ?? 'heifer_calf'
  const ease    = value?.ease ?? 1
  const set = (patch: Partial<NonNullable<TaskData['calved']>>) =>
    onChange({ calf_tag: calfTag, calf_sex: calfSex, ease, ...patch })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="type-section-label mb-2">CALF TAG #</p>
        <input
          type="text"
          value={calfTag}
          onChange={e => set({ calf_tag: e.target.value })}
          placeholder="Tag number"
          className="w-full px-4 rounded-[var(--radius-lg)] text-center font-mono font-bold"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '2px solid var(--border-strong)',
            color: 'var(--text)',
            fontSize: '2rem',
            fontFamily: 'var(--font-display)',
            minHeight: 64,
          }}
          inputMode="text"
          autoFocus
        />
      </div>
      <div>
        <p className="type-section-label mb-2">CALF SEX</p>
        <div className="grid grid-cols-3 gap-2">
          {([['heifer_calf', 'HEIFER'], ['bull_calf', 'BULL'], ['calf', 'UNKNOWN']] as const).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => set({ calf_sex: val })}
              className="rounded-[var(--radius-lg)] type-data-sm font-bold"
              style={{
                backgroundColor: calfSex === val ? 'var(--accent-soft)' : 'var(--surface-1)',
                border: `2px solid ${calfSex === val ? 'var(--accent-border)' : 'var(--border)'}`,
                color: calfSex === val ? 'var(--accent)' : 'var(--text-muted)',
                minHeight: 56,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="type-section-label mb-2">CALVING EASE <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(1 = unassisted)</span></p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => set({ ease: n })}
              className="flex-1 rounded-[var(--radius-md)] type-data-sm font-bold"
              style={{
                backgroundColor: ease === n ? 'var(--accent)' : 'var(--surface-1)',
                border: `1px solid ${ease === n ? 'var(--accent)' : 'var(--border)'}`,
                color: ease === n ? 'white' : 'var(--text-muted)',
                minHeight: 56,
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Task: Health ─────────────────────────────────────────────────────────────

function HealthTask({ value, onChange }: {
  value: TaskData['health']
  onChange: (v: TaskData['health']) => void
}) {
  const et   = value?.event_type  ?? 'treatment'
  const drug = value?.drug_name   ?? ''
  const dose = value?.dose_amount ?? ''
  const unit = value?.dose_unit   ?? 'mL'
  const set  = (patch: Partial<NonNullable<TaskData['health']>>) =>
    onChange({ event_type: et, drug_name: drug, dose_amount: dose, dose_unit: unit, ...patch })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="type-section-label mb-2">TYPE</p>
        <div className="grid grid-cols-3 gap-2">
          {([['treatment', 'TREATMENT'], ['vaccine', 'VACCINE'], ['observation', 'OBSERVE']] as const).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => set({ event_type: val })}
              className="rounded-[var(--radius-lg)] type-data-sm font-bold"
              style={{
                backgroundColor: et === val ? 'var(--accent-soft)' : 'var(--surface-1)',
                border: `2px solid ${et === val ? 'var(--accent-border)' : 'var(--border)'}`,
                color: et === val ? 'var(--accent)' : 'var(--text-muted)',
                minHeight: 56,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="type-section-label mb-2">DRUG / TREATMENT</p>
        <input
          type="text"
          value={drug}
          onChange={e => set({ drug_name: e.target.value })}
          placeholder="Drug or treatment name"
          className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 56 }}
          autoFocus
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="type-section-label mb-2">DOSE</p>
          <input
            type="text"
            value={dose}
            onChange={e => set({ dose_amount: e.target.value })}
            placeholder="Amount"
            className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 56 }}
            inputMode="decimal"
          />
        </div>
        <div>
          <p className="type-section-label mb-2">UNIT</p>
          <select
            value={unit}
            onChange={e => set({ dose_unit: e.target.value })}
            className="px-3 rounded-[var(--radius-lg)] type-body"
            style={{
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              minHeight: 56,
            }}
          >
            {['mL', 'cc', 'mg', 'g', 'tabs', 'oz'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── Tasks Screen ─────────────────────────────────────────────────────────────

function TasksScreen({
  animal, applicableTasks, taskIndex, taskData,
  onTaskDataChange, onNext, onSkip, onReview, tl,
}: {
  animal: AnimalLookup
  applicableTasks: TaskType[]
  taskIndex: number
  taskData: TaskData
  onTaskDataChange: (d: TaskData) => void
  onNext: () => void
  onSkip: () => void
  onReview: () => void
  tl: boolean
}) {
  const currentTask = applicableTasks[taskIndex]
  const isLast      = taskIndex === applicableTasks.length - 1

  const setVal = (key: TaskType, val: unknown) =>
    onTaskDataChange({ ...taskData, [key]: val })

  /* Left panel: animal info + task progress (tablet only) */
  const LeftPanel = () => (
    <div className="flex flex-col gap-5 p-5 h-full overflow-y-auto">
      {/* Animal card */}
      <div
        className="rounded-[var(--radius-xl)] p-4"
        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <EarTagDot color={animal.ear_tag_color} size="sm" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
            #{animal.tag_number}
          </span>
        </div>
        {animal.name && <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{animal.name}</p>}
        {animal.sex && (
          <p className="type-data-sm mt-0.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{animal.sex}</p>
        )}
      </div>

      {/* Completed tasks */}
      {taskIndex > 0 && (
        <div>
          <p className="type-section-label mb-2">COMPLETED</p>
          <div className="flex flex-col gap-1.5">
            {applicableTasks.slice(0, taskIndex).map(task => {
              const summary = getTaskSummary(task, taskData)
              return (
                <div
                  key={task}
                  className="flex items-center justify-between px-3 rounded-[var(--radius-md)]"
                  style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', minHeight: 40 }}
                >
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{TASK_LABELS[task]}</span>
                  <span className="type-helper font-semibold"
                    style={{ color: summary ? 'var(--success-fg)' : 'var(--text-muted)' }}>
                    {summary ?? 'SKIP'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Current task label */}
      <div>
        <p className="type-section-label mb-1">NOW</p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
          {TASK_LABELS[currentTask]}
        </p>
        <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {taskIndex + 1} of {applicableTasks.length}
        </p>
      </div>

      {/* Upcoming tasks */}
      {taskIndex < applicableTasks.length - 1 && (
        <div>
          <p className="type-section-label mb-2">UP NEXT</p>
          <div className="flex flex-col gap-1">
            {applicableTasks.slice(taskIndex + 1).map(task => (
              <p key={task} className="type-helper" style={{ color: 'var(--text-muted)' }}>
                · {TASK_LABELS[task]}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const TaskForm = () => (
    <>
      {currentTask === 'preg_check' && (
        <PregCheckTask value={taskData.preg_check} onChange={v => setVal('preg_check', v)} />
      )}
      {currentTask === 'weight' && (
        <WeightTask value={taskData.weight} onChange={v => setVal('weight', v)} />
      )}
      {currentTask === 'bred' && (
        <BredTask value={taskData.bred} onChange={v => setVal('bred', v)} tl={tl} />
      )}
      {currentTask === 'calved' && (
        <CalvedTask value={taskData.calved} onChange={v => setVal('calved', v)} />
      )}
      {currentTask === 'health' && (
        <HealthTask value={taskData.health} onChange={v => setVal('health', v)} />
      )}
    </>
  )

  const FooterControls = () => (
    <div
      className="flex gap-3 p-4 border-t shrink-0"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-1)' }}
    >
      <button
        onClick={onSkip}
        className="flex-1 rounded-[var(--radius-lg)] type-body font-semibold"
        style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', minHeight: 56 }}
      >
        SKIP
      </button>
      <button
        onClick={isLast ? onReview : onNext}
        className="flex-1 rounded-[var(--radius-lg)] type-body font-bold flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--accent)', color: 'white', flex: 2, minHeight: 56 }}
      >
        {isLast ? 'REVIEW' : 'NEXT'}
        <ChevronRight size={18} />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        {tl ? (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.08em', color: 'var(--text)' }}>
            CHUTE MODE
          </span>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <EarTagDot color={animal.ear_tag_color} size="sm" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
                #{animal.tag_number}
              </span>
              {animal.name && (
                <span className="truncate" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{animal.name}</span>
              )}
              {animal.sex && (
                <span className="type-data-sm shrink-0" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {animal.sex}
                </span>
              )}
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {taskIndex + 1} / {applicableTasks.length}
            </span>
          </>
        )}
      </div>

      {tl ? (
        /* ── Tablet: two-column layout ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: animal info + progress */}
          <div
            className="w-64 xl:w-72 shrink-0 border-r"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-1)' }}
          >
            <LeftPanel />
          </div>
          {/* Right panel: task form + footer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="px-6 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>TASK</p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>
                {TASK_LABELS[currentTask]}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <TaskForm />
            </div>
            <FooterControls />
          </div>
        </div>
      ) : (
        /* ── Mobile: single column ── */
        <>
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 py-3">
            {applicableTasks.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === taskIndex ? 24 : 8,
                  height: 8,
                  backgroundColor: i < taskIndex ? 'var(--success-fg)' : i === taskIndex ? 'var(--accent)' : 'var(--surface-3)',
                }}
              />
            ))}
          </div>

          {/* Task label */}
          <div className="px-5 pb-4">
            <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>TASK</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)', letterSpacing: '0.02em' }}>
              {TASK_LABELS[currentTask]}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5">
            <TaskForm />
          </div>

          <FooterControls />
        </>
      )}
    </div>
  )
}

// ─── Review Screen ────────────────────────────────────────────────────────────

function ReviewScreen({
  animal, applicableTasks, taskData, saving, error, onSave, onBack, tl,
}: {
  animal: AnimalLookup
  applicableTasks: TaskType[]
  taskData: TaskData
  saving: boolean
  error: string
  onSave: () => void
  onBack: () => void
  tl: boolean
}) {
  const SummaryRows = () => (
    <>
      {applicableTasks.map(task => {
        const summary = getTaskSummary(task, taskData)
        const skipped = !summary
        return (
          <div
            key={task}
            className="flex items-center justify-between px-4 rounded-[var(--radius-lg)]"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', minHeight: 52 }}
          >
            <span className="type-body" style={{ color: skipped ? 'var(--text-muted)' : 'var(--text)' }}>
              {TASK_LABELS[task]}
            </span>
            <span style={{
              color: skipped ? 'var(--text-muted)' : 'var(--accent)',
              fontWeight: skipped ? 400 : 700,
              fontSize: '0.85rem',
              fontFamily: skipped ? undefined : 'var(--font-display)',
            }}>
              {skipped ? 'SKIP' : summary}
            </span>
          </div>
        )
      })}
    </>
  )

  const AnimalCard = () => (
    <div
      className="rounded-[var(--radius-xl)] p-4"
      style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <EarTagDot color={animal.ear_tag_color} size="sm" />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
          #{animal.tag_number}
        </span>
      </div>
      {animal.name && <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{animal.name}</p>}
      {animal.sex && (
        <p className="type-data-sm mt-0.5" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{animal.sex}</p>
      )}
    </div>
  )

  const SaveButton = () => (
    <button
      onClick={onSave}
      disabled={saving}
      className="w-full rounded-[var(--radius-lg)] type-body font-bold tracking-widest disabled:opacity-40 transition-opacity"
      style={{ backgroundColor: 'var(--accent)', color: 'white', fontSize: '1rem', minHeight: 56 }}
    >
      {saving ? 'SAVING…' : 'SAVE & NEXT ANIMAL'}
    </button>
  )

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <button onClick={onBack} style={{ color: 'var(--text-muted)' }}>
          <X size={22} />
        </button>
        {!tl && (
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>
              #{animal.tag_number}
            </p>
            {animal.name && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{animal.name}</p>}
          </div>
        )}
        <span style={{ marginLeft: tl ? 0 : 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>REVIEW</span>
      </div>

      {tl ? (
        /* ── Tablet: summary left, animal + save right ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: task summaries */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
            <p className="type-section-label mb-1">TASKS</p>
            <SummaryRows />
            {error && (
              <p
                className="type-helper px-4 py-3 rounded-[var(--radius-md)]"
                style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
              >
                {error}
              </p>
            )}
          </div>
          {/* Right: animal card + save button */}
          <div
            className="w-72 shrink-0 border-l flex flex-col p-5 gap-5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-1)' }}
          >
            <AnimalCard />
            <div className="flex-1" />
            <SaveButton />
          </div>
        </div>
      ) : (
        /* ── Mobile: stacked ── */
        <>
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
            <SummaryRows />
            {error && (
              <p
                className="type-helper px-4 py-3 rounded-[var(--radius-md)]"
                style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
              >
                {error}
              </p>
            )}
          </div>
          <div className="p-5 pb-10 shrink-0">
            <SaveButton />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Summary Screen ───────────────────────────────────────────────────────────

function SummaryScreen({ processed, onFinish, tl }: {
  processed: ProcessedAnimal[]
  onFinish: () => void
  tl: boolean
}) {
  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      <div
        className="flex items-center justify-center h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', color: 'var(--text)' }}>
          SESSION COMPLETE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <p className="type-data-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          {processed.length} {processed.length === 1 ? 'animal' : 'animals'} worked
        </p>

        {processed.length === 0 && (
          <p className="type-body" style={{ color: 'var(--text-muted)' }}>No animals recorded this session.</p>
        )}

        <div className={tl ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
          {processed.map(p => (
            <div
              key={p.animal.id}
              className="rounded-[var(--radius-lg)] overflow-hidden"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}
              >
                <EarTagDot color={p.animal.ear_tag_color} size="sm" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>
                  #{p.animal.tag_number}
                </span>
                {p.animal.name && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.animal.name}</span>
                )}
                {p.animal.sex && (
                  <span className="type-data-sm" style={{ color: 'var(--text-muted)', marginLeft: 'auto', textTransform: 'uppercase' }}>
                    {p.animal.sex}
                  </span>
                )}
              </div>
              <div className="px-4 py-2 flex flex-col gap-1">
                {p.taskResults.map(r => (
                  <div key={r.task} className="flex justify-between type-helper">
                    <span style={{ color: 'var(--text-muted)' }}>{TASK_LABELS[r.task]}</span>
                    <span style={{ color: r.skipped ? 'var(--text-muted)' : 'var(--success-fg)', fontWeight: r.skipped ? 400 : 600 }}>
                      {r.skipped ? '—' : r.result}
                    </span>
                  </div>
                ))}
                {p.error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{p.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 pb-10 shrink-0">
        <button
          onClick={onFinish}
          className="w-full rounded-[var(--radius-lg)] type-body font-bold tracking-widest"
          style={{ backgroundColor: 'var(--accent)', color: 'white', fontSize: '1rem', minHeight: 56 }}
        >
          FINISH
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChutePage() {
  const router = useRouter()
  const tl     = useTabletLandscape()
  const today  = new Date().toISOString().slice(0, 10)

  const [screen,          setScreen]          = useState<Screen>('setup')
  const [date,            setDate]            = useState(today)
  const [selectedTasks,   setSelectedTasks]   = useState<TaskType[]>(['preg_check', 'weight'])
  const [currentAnimal,   setCurrentAnimal]   = useState<AnimalLookup | null>(null)
  const [applicableTasks, setApplicableTasks] = useState<TaskType[]>([])
  const [taskIndex,       setTaskIndex]       = useState(0)
  const [taskData,        setTaskData]        = useState<TaskData>({})
  const [processed,       setProcessed]       = useState<ProcessedAnimal[]>([])
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState('')
  const [undoAnimal,      setUndoAnimal]      = useState<{ animal: AnimalLookup; events: SavedEvent[] } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleAnimalLoaded = (animal: AnimalLookup) => {
    const applicable = selectedTasks.filter(t => taskApplies(t, animal.sex))
    setCurrentAnimal(animal)
    setApplicableTasks(applicable)
    setTaskIndex(0)
    setTaskData({})
    setSaveError('')
    setScreen(applicable.length === 0 ? 'review' : 'tasks')
  }

  const handleTaskSkip = () => {
    const task = applicableTasks[taskIndex]
    setTaskData(d => { const nd = { ...d }; delete nd[task]; return nd })
    if (taskIndex < applicableTasks.length - 1) setTaskIndex(i => i + 1)
    else setScreen('review')
  }

  const handleTaskNext = () => {
    if (taskIndex < applicableTasks.length - 1) setTaskIndex(i => i + 1)
  }

  const handleSave = async () => {
    if (!currentAnimal) return
    setSaving(true); setSaveError('')

    const savedEvents: SavedEvent[]  = []
    const taskResults: TaskResult[]  = []
    let error = ''

    try {
      const promises: Promise<void>[] = []

      if (taskData.preg_check) {
        promises.push((async () => {
          const res = await apiPost('/api/reproduction', {
            animal_id: currentAnimal.id, event_type: 'preg_check', event_date: date,
            preg_check_result: taskData.preg_check!.result,
            preg_check_method: taskData.preg_check!.method,
          })
          const j = await res.json()
          if (j.data?.id) savedEvents.push({ type: 'preg_check', deleteUrl: `/api/reproduction/${j.data.id}` })
          taskResults.push({ task: 'preg_check', result: taskData.preg_check!.result.toUpperCase(), skipped: false })
        })())
      } else if (applicableTasks.includes('preg_check')) {
        taskResults.push({ task: 'preg_check', result: '', skipped: true })
      }

      if (taskData.weight) {
        promises.push((async () => {
          const res = await apiPost(`/api/animals/${currentAnimal.id}/weights`, {
            weight_lbs: taskData.weight!.weight_lbs, weighed_at: date, source: 'manual',
          })
          const j = await res.json()
          if (j.id) savedEvents.push({ type: 'weight', deleteUrl: `/api/animals/${currentAnimal.id}/weights/${j.id}` })
          taskResults.push({ task: 'weight', result: `${taskData.weight!.weight_lbs} lbs`, skipped: false })
        })())
      } else if (applicableTasks.includes('weight')) {
        taskResults.push({ task: 'weight', result: '', skipped: true })
      }

      if (taskData.bred) {
        promises.push((async () => {
          const res = await apiPost('/api/reproduction', {
            animal_id: currentAnimal.id, event_type: 'bred', event_date: date,
            conception_method: taskData.bred!.conception_method,
            sire_name_text: taskData.bred!.sire_name_text || null,
          })
          const j = await res.json()
          if (j.data?.id) savedEvents.push({ type: 'bred', deleteUrl: `/api/reproduction/${j.data.id}` })
          taskResults.push({ task: 'bred', result: taskData.bred!.conception_method.toUpperCase(), skipped: false })
        })())
      } else if (applicableTasks.includes('bred')) {
        taskResults.push({ task: 'bred', result: '', skipped: true })
      }

      if (taskData.calved) {
        promises.push((async () => {
          const res = await apiPost('/api/reproduction', {
            animal_id: currentAnimal.id, event_type: 'calved', event_date: date,
            calving_ease_score: taskData.calved!.ease,
            create_calf: true,
            calf_data: {
              tag_number: taskData.calved!.calf_tag, sex: 'calf',
              calf_sex: taskData.calved!.calf_sex === 'calf' ? null : taskData.calved!.calf_sex,
              dob: date, birth_type: 'single', vigor_score: 2,
            },
          })
          const j = await res.json()
          if (j.repro_event?.id) savedEvents.push({ type: 'calved', deleteUrl: `/api/reproduction/${j.repro_event.id}` })
          taskResults.push({ task: 'calved', result: `Calf #${taskData.calved!.calf_tag}`, skipped: false })
        })())
      } else if (applicableTasks.includes('calved')) {
        taskResults.push({ task: 'calved', result: '', skipped: true })
      }

      if (taskData.health) {
        promises.push((async () => {
          const res = await apiPost('/api/health', {
            animal_id: currentAnimal.id, event_type: taskData.health!.event_type, event_date: date,
            drug_name: taskData.health!.drug_name || null,
            dose_amount: taskData.health!.dose_amount || null,
            dose_unit: taskData.health!.dose_unit || null,
          })
          const j = await res.json()
          if (j.data?.id) savedEvents.push({ type: 'health', deleteUrl: `/api/health/${j.data.id}` })
          taskResults.push({ task: 'health', result: taskData.health!.drug_name || taskData.health!.event_type, skipped: false })
        })())
      } else if (applicableTasks.includes('health')) {
        taskResults.push({ task: 'health', result: '', skipped: true })
      }

      await Promise.all(promises)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Save failed'
    }

    setSaving(false)
    if (error) { setSaveError(error); return }

    const entry: ProcessedAnimal = { animal: currentAnimal, taskResults, savedEvents }
    setProcessed(prev => [...prev, entry])

    setUndoAnimal({ animal: currentAnimal, events: savedEvents })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoAnimal(null), 12000)

    setCurrentAnimal(null); setTaskData({}); setScreen('animal')
  }

  const handleUndo = async () => {
    if (!undoAnimal) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndoAnimal(null)
    setProcessed(prev => prev.filter(p => p.animal.id !== undoAnimal.animal.id))
    await Promise.allSettled(undoAnimal.events.map(e => apiDelete(e.deleteUrl)))
  }

  return (
    <>
      {screen === 'setup' && (
        <SetupScreen
          date={date} setDate={setDate}
          selectedTasks={selectedTasks} setSelectedTasks={setSelectedTasks}
          onStart={() => { if (selectedTasks.length > 0) setScreen('animal') }}
          onExit={() => router.push('/animals')}
          tl={tl}
        />
      )}

      {screen === 'animal' && (
        <AnimalScreen
          processed={processed}
          onAnimalLoaded={handleAnimalLoaded}
          onDone={() => setScreen('summary')}
          onExit={() => setScreen('summary')}
          tl={tl}
        />
      )}

      {screen === 'tasks' && currentAnimal && (
        <TasksScreen
          animal={currentAnimal}
          applicableTasks={applicableTasks}
          taskIndex={taskIndex}
          taskData={taskData}
          onTaskDataChange={setTaskData}
          onNext={handleTaskNext}
          onSkip={handleTaskSkip}
          onReview={() => setScreen('review')}
          tl={tl}
        />
      )}

      {screen === 'review' && currentAnimal && (
        <ReviewScreen
          animal={currentAnimal}
          applicableTasks={applicableTasks}
          taskData={taskData}
          saving={saving}
          error={saveError}
          onSave={handleSave}
          onBack={() => {
            setTaskIndex(Math.max(0, applicableTasks.length - 1))
            setScreen(applicableTasks.length > 0 ? 'tasks' : 'animal')
          }}
          tl={tl}
        />
      )}

      {screen === 'summary' && (
        <SummaryScreen
          processed={processed}
          onFinish={() => router.push('/animals')}
          tl={tl}
        />
      )}

      {/* Undo snackbar */}
      {undoAnimal && (
        <div
          className="fixed bottom-8 left-4 right-4 flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-xl)] z-50"
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            maxWidth: tl ? 480 : undefined,
            margin: tl ? '0 auto' : undefined,
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={18} style={{ color: 'var(--success-fg)', flexShrink: 0 }} />
            <span className="type-body" style={{ color: 'var(--text)' }}>
              #{undoAnimal.animal.tag_number} saved
            </span>
          </div>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-3 rounded-[var(--radius-md)] type-data-sm font-bold shrink-0"
            style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-fg)',
              border: '1px solid var(--danger-border)',
              minHeight: 36,
            }}
          >
            <Undo2 size={14} />
            UNDO
          </button>
        </div>
      )}
    </>
  )
}
