'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Camera, ChevronRight, Undo2, CheckCircle, Plus } from 'lucide-react'
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/fetch'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { deriveReproStatus, type ReproStatusResult } from '@/lib/repro-status'

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskType = 'weights' | 'breeding' | 'preg_check' | 'working' | 'health' | 'ear_tags'
type Screen   = 'setup' | 'animal' | 'tasks' | 'confirm' | 'summary'
type AnimalFilter = 'all' | 'lease'

const TASK_ORDER: TaskType[] = ['weights', 'breeding', 'preg_check', 'working', 'health', 'ear_tags']

const TASK_DEFS: { id: TaskType; label: string; emoji: string }[] = [
  { id: 'breeding',   label: 'BREEDING',       emoji: '🐂' },
  { id: 'weights',    label: 'WEIGHTS',         emoji: '⚖️' },
  { id: 'working',    label: 'WORKING ANIMALS', emoji: '💉' },
  { id: 'health',     label: 'HEALTH / MEDS',   emoji: '🏥' },
  { id: 'ear_tags',   label: 'EAR TAGS',        emoji: '🏷️' },
  { id: 'preg_check', label: 'PREG CHECK',      emoji: '🔍' },
]

const TASK_LABEL: Record<TaskType, string> = Object.fromEntries(
  TASK_DEFS.map(t => [t.id, t.label])
) as Record<TaskType, string>

interface AnimalLookup {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  dob?: string | null
  ear_tag_color: string | null
  ear_tag_number: string | null
  owner_id: string | null
  breeding_eligible?: boolean | null
}

interface Lease { id: string; property_name: string }

interface SemenStraw {
  id: string
  sire_name: string
  straw_count: number
  price_per_straw: number | null
  is_sexed: boolean | null
  straw_size: string | null
  sire_library_id: string | null
  sire_library: {
    id: string; bull_name: string; breed: string | null
    epd_ced: number | null; epd_bw: number | null
    epd_ww: number | null; epd_yw: number | null
  } | null
}

interface TaskDataEntry {
  // weights
  weight_lbs?: number
  weight_estimated?: boolean
  // breeding
  semen_inventory_id?: string | null
  sire_name_text?: string
  sire_library_id?: string | null
  natural_service?: boolean
  not_bred?: boolean
  // preg_check
  preg_result?: 'confirmed' | 'open' | 'recheck' | null
  preg_method?: string
  preg_decision?: 're-breed' | 'cull' | 'monitor' | null
  // working
  working_items?: string[]
  // health
  health_type?: string
  health_drug?: string
  health_dose?: string
  health_unit?: string
  // ear_tags
  tag_status?: 'ok' | 'replacing' | 'adding' | 'missing'
  new_tag_number?: string
  new_tag_color?: string
}

interface SavedEvent { task: TaskType; deleteUrl: string }

interface StrawsUsedEntry {
  semen_inventory_id: string; sire_name: string; prev_count: number
}

interface ProcessedAnimal {
  animal: AnimalLookup
  taskData: TaskDataEntry
  savedEvents: SavedEvent[]
  applicableTasks: TaskType[]
  strawsUsed?: StrawsUsedEntry
  extraDeleteUrls?: string[]
  error?: string
}

// ── Session persistence ────────────────────────────────────────────────────────

const SESSION_KEY = 'chute_session_v3'
const TECH_KEY    = 'chute_technician'

interface ChuteSession {
  tasks: TaskType[]; animalFilter: AnimalFilter; leaseId: string | null
  technician: string; date: string; startedAt: string
}

function saveSession(s: ChuteSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {}
}
function loadSession(): ChuteSession | null {
  try { const r = sessionStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY) } catch {} }

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useTabletLandscape(): boolean {
  const [tl, setTl] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (orientation: landscape)')
    setTl(mq.matches)
    const h = (e: MediaQueryListEvent) => setTl(e.matches)
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h)
  }, [])
  return tl
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function taskApplies(task: TaskType, sex: string | null): boolean {
  if (task === 'breeding' || task === 'preg_check') return sex === 'cow' || sex === 'heifer'
  return true
}

function taskSummaryText(task: TaskType, td: TaskDataEntry): string | null {
  if (task === 'weights')   return td.weight_lbs  ? `${td.weight_lbs} lbs${td.weight_estimated ? ' (est)' : ''}` : null
  if (task === 'breeding') {
    if (td.not_bred)        return 'Not bred'
    if (td.natural_service) return 'Natural service'
    if (td.sire_name_text)  return td.sire_name_text
    return null
  }
  if (task === 'preg_check') {
    if (td.preg_result === null) return 'Skipped'
    return td.preg_result ? td.preg_result.toUpperCase() : null
  }
  if (task === 'working')  return td.working_items?.length ? td.working_items.slice(0, 2).join(', ') + (td.working_items.length > 2 ? '…' : '') : null
  if (task === 'health')   return td.health_drug || td.health_type || null
  if (task === 'ear_tags') {
    if (td.tag_status === 'ok')       return 'No change'
    if (td.tag_status === 'replacing') return `Replaced → ${td.new_tag_number || '?'}`
    if (td.tag_status === 'adding')    return `Added ${td.new_tag_number || '?'}`
    if (td.tag_status === 'missing')   return `New tag ${td.new_tag_number || '?'}`
    return null
  }
  return null
}

const today = () => new Date().toISOString().slice(0, 10)

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Setup Screen ───────────────────────────────────────────────────────────────

const EAR_TAG_COLORS = ['Yellow', 'White', 'Green', 'Orange', 'Red', 'Blue', 'Purple', 'Pink', 'Black']
const COLOR_HEX: Record<string, string> = {
  Yellow: '#FFD700', White: '#F5F5F5', Green: '#4CAF50', Orange: '#FF8C00',
  Red: '#E53E3E', Blue: '#3182CE', Purple: '#805AD5', Pink: '#ED64A6', Black: '#1A1A1A',
}

function SetupScreen({
  tasks, setTasks, animalFilter, setAnimalFilter, leaseId, setLeaseId,
  technician, setTechnician, date, setDate, onStart,
}: {
  tasks: TaskType[]; setTasks: (t: TaskType[]) => void
  animalFilter: AnimalFilter; setAnimalFilter: (f: AnimalFilter) => void
  leaseId: string | null; setLeaseId: (id: string | null) => void
  technician: string; setTechnician: (t: string) => void
  date: string; setDate: (d: string) => void
  onStart: () => void
}) {
  const [leases, setLeases] = useState<Lease[]>([])

  useEffect(() => {
    apiGet('/api/leases?limit=50').then(r => r.json()).then(j => setLeases(j.data ?? [])).catch(() => {})
  }, [])

  const toggle = (id: TaskType) =>
    setTasks(tasks.includes(id) ? tasks.filter(t => t !== id) : [...tasks, id])

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="flex items-center justify-center px-5 py-5 shrink-0">
        <div className="text-center">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '0.1em' }}>
            CHUTE MODE
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: 2 }}>
            What are we doing today?
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-6">
        {/* Task tiles — 2-col grid */}
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>
            SELECT TASKS
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TASK_DEFS.map(def => {
              const on = tasks.includes(def.id)
              return (
                <button
                  key={def.id}
                  onClick={() => toggle(def.id)}
                  className="flex flex-col items-start gap-1 rounded-2xl transition-all"
                  style={{
                    backgroundColor: on ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${on ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                    padding: '16px 14px',
                    minHeight: 80,
                  }}
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{def.emoji}</span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700,
                    fontSize: '0.7rem', letterSpacing: '0.08em',
                    color: on ? 'var(--accent)' : 'rgba(255,255,255,0.7)',
                    lineHeight: 1.2,
                  }}>
                    {def.label}
                  </span>
                  {on && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 18, height: 18, borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: 'white', fontSize: 10, fontWeight: 900 }}>✓</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Which animals */}
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>
            WHICH ANIMALS?
          </p>
          <div className="flex gap-2">
            {(['all', 'lease'] as AnimalFilter[]).map(f => (
              <button
                key={f}
                onClick={() => { setAnimalFilter(f); if (f !== 'lease') setLeaseId(null) }}
                className="flex-1 rounded-xl"
                style={{
                  backgroundColor: animalFilter === f ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${animalFilter === f ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                  color: animalFilter === f ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem',
                  letterSpacing: '0.08em', minHeight: 44,
                }}
              >
                {f === 'all' ? 'ALL CATTLE' : 'BY LEASE'}
              </button>
            ))}
          </div>
          {animalFilter === 'lease' && leases.length > 0 && (
            <select
              value={leaseId ?? ''}
              onChange={e => setLeaseId(e.target.value || null)}
              className="w-full mt-2 px-4 py-3 rounded-xl"
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', fontSize: '0.9rem',
              }}
            >
              <option value="">— Select a lease —</option>
              {leases.map(l => <option key={l.id} value={l.id}>{l.property_name}</option>)}
            </select>
          )}
        </div>

        {/* Technician */}
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>
            TECHNICIAN
          </p>
          <input
            type="text"
            value={technician}
            onChange={e => {
              setTechnician(e.target.value)
              try { localStorage.setItem(TECH_KEY, e.target.value) } catch {}
            }}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-xl"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white', fontSize: '1rem',
            }}
          />
        </div>

        {/* Date */}
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>
            DATE
          </p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white', fontSize: '1rem',
            }}
          />
        </div>
      </div>

      {/* Start button */}
      <div className="px-5 pb-10 pt-3 shrink-0">
        <button
          onClick={onStart}
          disabled={tasks.length === 0}
          className="w-full rounded-2xl font-bold tracking-widest disabled:opacity-30 transition-opacity"
          style={{
            backgroundColor: 'var(--accent)', color: 'white',
            fontSize: '1.1rem', minHeight: 62,
            fontFamily: 'var(--font-display)', letterSpacing: '0.1em',
          }}
        >
          START SESSION →
        </button>
      </div>
    </div>
  )
}

// ── New Animal Sheet ───────────────────────────────────────────────────────────

function NewAnimalSheet({ onSave, onClose }: {
  onSave: (animal: AnimalLookup) => void
  onClose: () => void
}) {
  const [color,  setColor]  = useState<string | null>(null)
  const [tag,    setTag]    = useState('')
  const [sex,    setSex]    = useState('cow')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const SEXES = ['cow', 'heifer', 'bull', 'steer', 'calf']

  const handleSave = async () => {
    if (!tag.trim()) { setError('Tag number required'); return }
    setSaving(true); setError('')
    try {
      const res  = await apiPost('/api/animals', {
        tag_number: tag.trim(), ear_tag_color: color, sex, status: 'active',
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error ?? 'Save failed'); return }
      const a = j.data
      onSave({ id: a.id, tag_number: a.tag_number, name: a.name ?? null, sex: a.sex, ear_tag_color: a.ear_tag_color, ear_tag_number: a.ear_tag_number ?? null, owner_id: a.owner_id ?? null })
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
        style={{ backgroundColor: 'var(--surface-1)', maxHeight: '80vh', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)' }}>NEW ANIMAL</span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
          <div>
            <p className="type-section-label mb-2">EAR TAG COLOR</p>
            <div className="flex flex-wrap gap-2">
              {EAR_TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-9 h-9 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: COLOR_HEX[c] ?? '#888',
                    borderColor: color === c ? 'var(--accent)' : 'transparent',
                    boxShadow: color === c ? '0 0 0 2px var(--accent)' : 'none',
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="type-section-label mb-2">TAG NUMBER</p>
            <input
              type="text" value={tag} onChange={e => setTag(e.target.value)}
              placeholder="e.g. 33"
              className="w-full px-4 py-3 rounded-[var(--radius-lg)] text-center font-mono font-bold"
              style={{ backgroundColor: 'var(--surface-0)', border: '2px solid var(--border-strong)', color: 'var(--text)', fontSize: '2rem', fontFamily: 'var(--font-display)', minHeight: 64 }}
            />
          </div>
          <div>
            <p className="type-section-label mb-2">SEX</p>
            <div className="grid grid-cols-3 gap-2">
              {SEXES.map(s => (
                <button key={s} onClick={() => setSex(s)}
                  className="py-2.5 rounded-[var(--radius-md)] type-data-sm font-bold capitalize"
                  style={{
                    backgroundColor: sex === s ? 'var(--accent-soft)' : 'var(--surface-2)',
                    border: `1px solid ${sex === s ? 'var(--accent-border)' : 'var(--border)'}`,
                    color: sex === s ? 'var(--accent)' : 'var(--text-muted)',
                    minHeight: 44,
                  }}
                >{s.toUpperCase()}</button>
              ))}
            </div>
          </div>
          {error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
        </div>
        <div className="px-5 pb-8 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="w-full rounded-[var(--radius-lg)] type-body font-bold tracking-widest disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: 'white', minHeight: 56 }}>
            {saving ? 'SAVING…' : 'SAVE & CONTINUE'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Animal ID Screen ───────────────────────────────────────────────────────────

function AnimalScreen({
  processed, sessionDate, onAnimalLoaded, onDone, onExit,
}: {
  processed: ProcessedAnimal[]
  sessionDate: string
  onAnimalLoaded: (a: AnimalLookup) => void
  onDone: () => void
  onExit: () => void
}) {
  const [tagInput,  setTagInput]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [error,     setError]     = useState('')
  const [showNew,   setShowNew]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const lookup = async (tag: string) => {
    const t = tag.trim()
    if (!t) return
    setLoading(true); setError('')
    try {
      const res  = await apiGet(`/api/animals?search=${encodeURIComponent(t)}&limit=8`)
      const json = await res.json()
      const animals: AnimalLookup[] = json.data ?? []
      const exact = animals.find(a => a.tag_number.toLowerCase() === t.toLowerCase())
      const match = exact ?? animals[0]
      if (!match) { setError(`No animal found with tag #${t}`); return }
      setTagInput(''); onAnimalLoaded(match)
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
        const dataUrl    = reader.result as string
        const base64     = dataUrl.split(',')[1]
        const mimeMatch  = dataUrl.match(/data:([^;]+);/)
        const media_type = mimeMatch?.[1] ?? 'image/jpeg'
        const res  = await apiPost('/api/ai/read-tag', { image_base64: base64, media_type })
        const json = await res.json()
        if (json.tag_number) {
          setTagInput(json.tag_number)
          await lookup(json.tag_number)
        } else {
          setError("Couldn't read tag — enter manually")
        }
      } catch {
        setError('Camera error — enter manually')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const recentTiles = [...processed].reverse().slice(0, 9)

  return (
    <>
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0"
          style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}>
          <button onClick={onExit} style={{ color: 'var(--text-muted)' }}>
            <X size={22} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', letterSpacing: '0.1em' }}>
            CHUTE MODE
          </span>
          <div className="flex items-center gap-2">
            {processed.length > 0 && (
              <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>{processed.length} done</span>
            )}
            {processed.length > 0 && (
              <button onClick={onDone}
                className="px-3 rounded-[var(--radius-md)] type-data-sm font-bold"
                style={{ backgroundColor: 'var(--accent)', color: 'white', minHeight: 32 }}>
                DONE
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Hero question */}
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.4rem', color: 'var(--text)', letterSpacing: '0.02em' }}>
            WHO&rsquo;S IN THE CHUTE?
          </p>

          {/* Recent animal tiles */}
          {recentTiles.length > 0 && (
            <div>
              <p className="type-section-label mb-2">DONE THIS SESSION</p>
              <div className="grid grid-cols-3 gap-2">
                {recentTiles.map(p => (
                  <div key={p.animal.id}
                    className="flex flex-col items-center justify-center gap-1 rounded-2xl"
                    style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', minHeight: 80, padding: '10px 6px' }}>
                    <EarTagDot color={p.animal.ear_tag_color} size="sm" />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: '0.85rem' }}>
                      #{p.animal.tag_number}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {p.animal.sex ?? ''}
                    </span>
                    <CheckCircle size={12} style={{ color: 'var(--success-fg)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo scan */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }} />
          <button onClick={() => fileRef.current?.click()} disabled={scanning}
            className="w-full rounded-2xl flex items-center justify-center gap-2 font-bold transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: 'var(--surface-3)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', minHeight: 60,
              fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.06em',
            }}>
            <Camera size={22} />
            {scanning ? 'READING TAG…' : '📷  READ TAG'}
          </button>

          {/* Tag search */}
          <div>
            <p className="type-section-label mb-2">SEARCH BY TAG NUMBER</p>
            <div className="flex gap-2">
              <input
                type="text" value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookup(tagInput)}
                placeholder="Tag #"
                className="flex-1 px-4 rounded-2xl text-center"
                style={{
                  backgroundColor: 'var(--surface-1)', border: '2px solid var(--border-strong)',
                  color: 'var(--text)', fontSize: '2rem', fontWeight: 700,
                  fontFamily: 'var(--font-display)', minHeight: 64,
                }}
                inputMode="text" autoFocus
              />
              <button onClick={() => lookup(tagInput)} disabled={loading || !tagInput.trim()}
                className="px-4 rounded-2xl font-bold disabled:opacity-40 flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)', color: 'white', minWidth: 60 }}>
                {loading ? '…' : <ChevronRight size={28} />}
              </button>
            </div>
            {error && <p className="type-helper mt-2" style={{ color: 'var(--danger-fg)' }}>{error}</p>}
          </div>

          {/* New animal */}
          <button onClick={() => setShowNew(true)}
            className="flex items-center justify-center gap-2 w-full rounded-2xl type-body"
            style={{
              border: '1px dashed var(--border-strong)', color: 'var(--text-muted)',
              minHeight: 52, backgroundColor: 'transparent',
            }}>
            <Plus size={16} /> NEW ANIMAL
          </button>
        </div>
      </div>

      {showNew && (
        <NewAnimalSheet
          onSave={a => { setShowNew(false); onAnimalLoaded(a) }}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  )
}

// ── Task: Weights (with numpad) ────────────────────────────────────────────────

function WeightTask({ value, onChange }: {
  value: TaskDataEntry
  onChange: (patch: Partial<TaskDataEntry>) => void
}) {
  const [display, setDisplay] = useState(value.weight_lbs?.toString() ?? '')

  const press = useCallback((key: string) => {
    setDisplay(prev => {
      let next: string
      if (key === '⌫')      next = prev.slice(0, -1)
      else if (key === '.') next = prev.includes('.') ? prev : prev + '.'
      else                  next = prev + key
      const n = parseFloat(next)
      onChange({ weight_lbs: !isNaN(n) && n > 0 ? n : undefined })
      return next
    })
  }, [onChange])

  const KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','.']

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Giant display */}
      <div className="flex items-end gap-3 py-4">
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 900,
          color: display ? 'var(--text)' : 'var(--text-muted)', lineHeight: 1, minWidth: 200, textAlign: 'center',
        }}>
          {display || '0'}
        </span>
        <span style={{ fontSize: '1.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>lbs</span>
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
        {KEYS.map(k => (
          <button key={k} onClick={() => press(k)}
            className="flex items-center justify-center rounded-2xl font-bold transition-all active:scale-95"
            style={{
              backgroundColor: k === '⌫' ? 'var(--danger-bg)' : 'var(--surface-1)',
              border: `1px solid ${k === '⌫' ? 'var(--danger-border)' : 'var(--border)'}`,
              color: k === '⌫' ? 'var(--danger-fg)' : 'var(--text)',
              fontSize: '1.5rem', fontFamily: 'var(--font-display)', minHeight: 64,
            }}>
            {k}
          </button>
        ))}
      </div>

      {/* Estimated toggle */}
      <label className="flex items-center gap-3 cursor-pointer mt-2">
        <div
          onClick={() => onChange({ weight_estimated: !value.weight_estimated })}
          className="relative rounded-full transition-colors"
          style={{
            width: 44, height: 24,
            backgroundColor: value.weight_estimated ? 'var(--accent)' : 'var(--surface-3)',
          }}
        >
          <div className="absolute top-1 rounded-full transition-transform"
            style={{
              width: 16, height: 16, backgroundColor: 'white',
              left: value.weight_estimated ? 24 : 4,
            }} />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Mark as estimated</span>
      </label>

      {/* Connect scale ghost */}
      <button className="type-helper mt-1" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
        Connect Scale (Gallagher W0) →
      </button>
    </div>
  )
}

// ── Task: Breeding (semen inventory) ──────────────────────────────────────────

function BreedingTask({ value, onChange }: {
  value: TaskDataEntry
  onChange: (patch: Partial<TaskDataEntry>) => void
}) {
  const [straws,  setStraws]  = useState<SemenStraw[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/genetics/tank').then(r => r.json())
      .then(j => setStraws(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selected = value.semen_inventory_id

  const selectStraw = (s: SemenStraw) => {
    if (s.straw_count <= 0) return
    onChange({
      semen_inventory_id: s.id,
      sire_name_text: s.sire_name,
      sire_library_id: s.sire_library_id ?? null,
      natural_service: false,
      not_bred: false,
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <span style={{ color: 'var(--text-muted)' }}>Loading inventory…</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>SELECT BULL</p>

      {straws.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No semen inventory found.</p>
      )}

      {straws.map(s => {
        const isSelected = selected === s.id
        const isOut      = s.straw_count <= 0
        const lib        = s.sire_library
        return (
          <button
            key={s.id}
            onClick={() => selectStraw(s)}
            disabled={isOut}
            className="text-left rounded-2xl px-4 py-3 transition-all disabled:opacity-40"
            style={{
              backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface-1)',
              border: `2px solid ${isSelected ? 'var(--accent)' : isOut ? 'var(--danger-border)' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text)', fontSize: '1rem' }}>
                {s.sire_name}
                {s.is_sexed && <span style={{ fontSize: '0.65rem', marginLeft: 6, color: 'var(--info-fg)' }}>♀ SEXED</span>}
                {s.straw_size === '0.25' && <span style={{ fontSize: '0.65rem', marginLeft: 4, color: 'var(--text-muted)' }}>¼cc</span>}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: isOut ? 'var(--danger-fg)' : s.straw_count <= 3 ? 'var(--warning-fg)' : 'var(--success-fg)',
                fontSize: '0.85rem',
              }}>
                {s.straw_count} 🌾
              </span>
            </div>
            {lib && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {lib.breed && <span>{lib.breed} · </span>}
                {lib.epd_ced  != null && <span>CED:{lib.epd_ced} </span>}
                {lib.epd_bw   != null && <span>BW:{lib.epd_bw} </span>}
                {lib.epd_ww   != null && <span>WW:{lib.epd_ww} </span>}
                {lib.epd_yw   != null && <span>YW:{lib.epd_yw}</span>}
              </div>
            )}
          </button>
        )
      })}

      {/* Natural / not bred */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onChange({ natural_service: true, not_bred: false, semen_inventory_id: null, sire_name_text: 'Natural service' })}
          className="flex-1 rounded-2xl type-data-sm font-bold"
          style={{
            backgroundColor: value.natural_service ? 'var(--accent-soft)' : 'var(--surface-2)',
            border: `1px solid ${value.natural_service ? 'var(--accent-border)' : 'var(--border)'}`,
            color: value.natural_service ? 'var(--accent)' : 'var(--text-muted)',
            minHeight: 52,
          }}>
          NATURAL SERVICE
        </button>
        <button
          onClick={() => onChange({ not_bred: true, natural_service: false, semen_inventory_id: null })}
          className="flex-1 rounded-2xl type-data-sm font-bold"
          style={{
            backgroundColor: value.not_bred ? 'rgba(113,128,150,0.2)' : 'var(--surface-2)',
            border: `1px solid ${value.not_bred ? 'var(--border-strong)' : 'var(--border)'}`,
            color: 'var(--text-muted)', minHeight: 52,
          }}>
          NOT BRED TODAY
        </button>
      </div>
    </div>
  )
}

// ── Task: Preg Check ──────────────────────────────────────────────────────────

function PregCheckTask({ value, onChange }: {
  value: TaskDataEntry
  onChange: (patch: Partial<TaskDataEntry>) => void
}) {
  const result = value.preg_result
  const method = value.preg_method ?? 'ultrasound'

  const TILES = [
    { key: 'confirmed' as const, label: 'CONFIRMED BRED', emoji: '✓',
      bg: 'var(--success-bg)', border: 'var(--success-border)', fg: 'var(--success-fg)' },
    { key: 'open'      as const, label: 'OPEN — Did not settle', emoji: '✗',
      bg: 'var(--warning-bg)', border: 'var(--warning-border)', fg: 'var(--warning-fg)' },
    { key: 'recheck'   as const, label: 'RECHECK — Uncertain', emoji: '?',
      bg: 'var(--info-bg)',    border: 'var(--info-border)',    fg: 'var(--info-fg)' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Method */}
      <div className="flex gap-2">
        {[['ultrasound', 'ULTRASOUND'], ['manual', 'RECTAL'], ['blood_test', 'BLOOD']].map(([val, lbl]) => (
          <button key={val} onClick={() => onChange({ preg_method: val })}
            className="flex-1 rounded-[var(--radius-lg)] type-data-sm font-semibold"
            style={{
              backgroundColor: method === val ? 'var(--accent-soft)' : 'var(--surface-1)',
              border: `1px solid ${method === val ? 'var(--accent-border)' : 'var(--border)'}`,
              color: method === val ? 'var(--accent)' : 'var(--text-muted)',
              minHeight: 44,
            }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Result tiles */}
      {TILES.map(t => (
        <button key={t.key} onClick={() => onChange({ preg_result: t.key, preg_decision: null })}
          className="w-full flex items-center gap-4 px-5 rounded-2xl text-left transition-all"
          style={{
            backgroundColor: result === t.key ? t.bg : 'var(--surface-1)',
            border: `2px solid ${result === t.key ? t.border : 'var(--border)'}`,
            color: result === t.key ? t.fg : 'var(--text-muted)',
            minHeight: 64,
          }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, width: 24, textAlign: 'center' }}>{t.emoji}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' }}>
            {t.label}
          </span>
        </button>
      ))}

      {/* OPEN decision */}
      {result === 'open' && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
          <p style={{ color: 'var(--warning-fg)', fontWeight: 700, fontSize: '0.8rem', marginBottom: 10 }}>
            WHAT&rsquo;S NEXT FOR THIS COW?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['re-breed', 'cull', 'monitor'] as const).map(d => (
              <button key={d} onClick={() => onChange({ preg_decision: d })}
                className="rounded-xl type-data-sm font-bold capitalize"
                style={{
                  backgroundColor: value.preg_decision === d ? 'var(--warning-fg)' : 'rgba(255,255,255,0.1)',
                  color: value.preg_decision === d ? 'white' : 'var(--warning-fg)',
                  border: `1px solid var(--warning-border)`, minHeight: 44,
                }}>
                {d.replace('-', '‑').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skip */}
      <button onClick={() => onChange({ preg_result: null })}
        className="w-full flex items-center gap-4 px-5 rounded-2xl text-left"
        style={{
          backgroundColor: result === null && value.preg_method !== undefined ? 'var(--surface-3)' : 'var(--surface-1)',
          border: '1px solid var(--border)', color: 'var(--text-muted)', minHeight: 56,
        }}>
        <span style={{ fontSize: '1.2rem', width: 24, textAlign: 'center' }}>—</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem' }}>
          SKIP preg check today
        </span>
      </button>
    </div>
  )
}

// ── Task: Working Animals ─────────────────────────────────────────────────────

const WORKING_BASE = ['Wormer', 'Ear Tags / ID Check', 'Branding', 'Fly Tags']
const VACCINES = ['IBR', 'BVD', 'PI3', 'BRSV', 'Lepto', 'Blackleg']

function WorkingTask({ value, onChange }: {
  value: TaskDataEntry
  onChange: (patch: Partial<TaskDataEntry>) => void
}) {
  const items = value.working_items ?? []
  const [vaccineOpen,   setVaccineOpen]   = useState(false)
  const [woundOpen,     setWoundOpen]     = useState(false)
  const [woundNote,     setWoundNote]     = useState('')
  const [otherText,     setOtherText]     = useState('')
  const [otherOpen,     setOtherOpen]     = useState(false)

  const toggle = (item: string) => {
    const next = items.includes(item) ? items.filter(i => i !== item) : [...items, item]
    onChange({ working_items: next })
  }

  const CheckRow = ({ label }: { label: string }) => (
    <button onClick={() => toggle(label)}
      className="flex items-center gap-3 px-4 rounded-2xl w-full text-left"
      style={{
        backgroundColor: items.includes(label) ? 'var(--accent-soft)' : 'var(--surface-1)',
        border: `1px solid ${items.includes(label) ? 'var(--accent-border)' : 'var(--border)'}`,
        minHeight: 56, marginBottom: 6,
      }}>
      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
        style={{
          backgroundColor: items.includes(label) ? 'var(--accent)' : 'transparent',
          border: items.includes(label) ? 'none' : '2px solid var(--border-strong)',
        }}>
        {items.includes(label) && <span style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>✓</span>}
      </div>
      <span style={{ color: items.includes(label) ? 'var(--accent)' : 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>
        {label}
      </span>
    </button>
  )

  return (
    <div className="flex flex-col">
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 12 }}>
        Uncheck if NOT done on this animal
      </p>

      {WORKING_BASE.map(label => <CheckRow key={label} label={label} />)}

      {/* Vaccines (expandable) */}
      <button onClick={() => setVaccineOpen(o => !o)}
        className="flex items-center gap-3 px-4 rounded-2xl w-full text-left mb-1.5"
        style={{
          backgroundColor: items.some(i => VACCINES.includes(i)) ? 'var(--accent-soft)' : 'var(--surface-1)',
          border: `1px solid ${items.some(i => VACCINES.includes(i)) ? 'var(--accent-border)' : 'var(--border)'}`,
          minHeight: 56,
        }}>
        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{
            backgroundColor: items.some(i => VACCINES.includes(i)) ? 'var(--accent)' : 'transparent',
            border: items.some(i => VACCINES.includes(i)) ? 'none' : '2px solid var(--border-strong)',
          }}>
          {items.some(i => VACCINES.includes(i)) && <span style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>✓</span>}
        </div>
        <span style={{ color: items.some(i => VACCINES.includes(i)) ? 'var(--accent)' : 'var(--text)', fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>
          Vaccines
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{vaccineOpen ? '▲' : '▼'}</span>
      </button>
      {vaccineOpen && (
        <div className="grid grid-cols-2 gap-2 mb-3 pl-4">
          {VACCINES.map(v => (
            <button key={v} onClick={() => toggle(v)}
              className="flex items-center gap-2 px-3 rounded-xl"
              style={{
                backgroundColor: items.includes(v) ? 'var(--accent-soft)' : 'var(--surface-2)',
                border: `1px solid ${items.includes(v) ? 'var(--accent-border)' : 'var(--border)'}`,
                color: items.includes(v) ? 'var(--accent)' : 'var(--text-muted)',
                minHeight: 40, fontWeight: 600, fontSize: '0.8rem',
              }}>
              {items.includes(v) && <span>✓</span>} {v}
            </button>
          ))}
        </div>
      )}

      {/* Wound care (expandable) */}
      <button onClick={() => { setWoundOpen(o => !o); if (!woundOpen) toggle('Wound Care') }}
        className="flex items-center gap-3 px-4 rounded-2xl w-full text-left mb-1.5"
        style={{
          backgroundColor: items.includes('Wound Care') ? 'var(--accent-soft)' : 'var(--surface-1)',
          border: `1px solid ${items.includes('Wound Care') ? 'var(--accent-border)' : 'var(--border)'}`,
          minHeight: 56,
        }}>
        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{
            backgroundColor: items.includes('Wound Care') ? 'var(--accent)' : 'transparent',
            border: items.includes('Wound Care') ? 'none' : '2px solid var(--border-strong)',
          }}>
          {items.includes('Wound Care') && <span style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>✓</span>}
        </div>
        <span style={{ color: items.includes('Wound Care') ? 'var(--accent)' : 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>
          Wound Care
        </span>
      </button>
      {woundOpen && (
        <input type="text" value={woundNote}
          onChange={e => {
            setWoundNote(e.target.value)
            const filtered = items.filter(i => !i.startsWith('Wound:'))
            onChange({ working_items: [...filtered, `Wound: ${e.target.value}`] })
          }}
          placeholder="Describe wound / treatment…"
          className="mb-3 ml-4 px-3 py-2 rounded-xl type-body"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 44 }}
        />
      )}

      {/* Other */}
      <button onClick={() => setOtherOpen(o => !o)}
        className="flex items-center gap-3 px-4 rounded-2xl w-full text-left mb-1.5"
        style={{
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border)',
          minHeight: 56,
        }}>
        <div className="w-6 h-6 rounded" style={{ border: '2px solid var(--border-strong)' }} />
        <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>Other…</span>
      </button>
      {otherOpen && (
        <input type="text" value={otherText}
          onChange={e => {
            setOtherText(e.target.value)
            const filtered = items.filter(i => !i.startsWith('Other:'))
            if (e.target.value) onChange({ working_items: [...filtered, `Other: ${e.target.value}`] })
          }}
          placeholder="Describe…"
          className="mb-3 ml-4 px-3 py-2 rounded-xl type-body"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 44 }}
        />
      )}
    </div>
  )
}

// ── Task: Health / Meds ───────────────────────────────────────────────────────

const QUICK_MEDS = ['Cydectin', 'LA-200', 'Draxxin', 'Baytril', 'Nuflor', 'Excede']

function HealthTask({ value, onChange }: {
  value: TaskDataEntry
  onChange: (patch: Partial<TaskDataEntry>) => void
}) {
  const et   = value.health_type  ?? 'treatment'
  const drug = value.health_drug  ?? ''
  const dose = value.health_dose  ?? ''
  const unit = value.health_unit  ?? 'mL'

  const set = (patch: Partial<TaskDataEntry>) => onChange(patch)

  return (
    <div className="flex flex-col gap-4">
      {/* Quick-tap meds */}
      <div>
        <p className="type-section-label mb-2">RECENT MEDICATIONS</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_MEDS.map(m => (
            <button key={m} onClick={() => set({ health_drug: drug === m ? '' : m })}
              className="px-3 rounded-full type-data-sm font-semibold"
              style={{
                backgroundColor: drug === m ? 'var(--accent)' : 'var(--surface-2)',
                color: drug === m ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${drug === m ? 'var(--accent)' : 'var(--border)'}`,
                minHeight: 36,
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div>
        <p className="type-section-label mb-2">TYPE</p>
        <div className="grid grid-cols-3 gap-2">
          {([['treatment', 'TREATMENT'], ['vaccine', 'VACCINE'], ['observation', 'OBSERVE']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => set({ health_type: val })}
              className="rounded-[var(--radius-lg)] type-data-sm font-bold"
              style={{
                backgroundColor: et === val ? 'var(--accent-soft)' : 'var(--surface-1)',
                border: `2px solid ${et === val ? 'var(--accent-border)' : 'var(--border)'}`,
                color: et === val ? 'var(--accent)' : 'var(--text-muted)',
                minHeight: 56,
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="type-section-label mb-2">DRUG / TREATMENT</p>
        <input type="text" value={drug} onChange={e => set({ health_drug: e.target.value })}
          placeholder="Drug or treatment name"
          className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 56 }}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <p className="type-section-label mb-2">DOSE</p>
          <input type="text" value={dose} onChange={e => set({ health_dose: e.target.value })}
            placeholder="Amount"
            className="w-full px-4 py-3 rounded-[var(--radius-lg)] type-body"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 56 }}
            inputMode="decimal"
          />
        </div>
        <div>
          <p className="type-section-label mb-2">UNIT</p>
          <select value={unit} onChange={e => set({ health_unit: e.target.value })}
            className="px-3 rounded-[var(--radius-lg)] type-body"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 56 }}>
            {['mL', 'cc', 'mg', 'g', 'tabs', 'oz'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Task: Ear Tags ────────────────────────────────────────────────────────────

function EarTagsTask({ animal, value, onChange }: {
  animal: AnimalLookup
  value: TaskDataEntry
  onChange: (patch: Partial<TaskDataEntry>) => void
}) {
  const status = value.tag_status ?? null
  const newTag  = value.new_tag_number ?? ''
  const newColor = value.new_tag_color ?? null

  const StatusOpts = [
    { key: 'ok'       as const, label: 'Tag is fine — no change' },
    { key: 'replacing'as const, label: 'Replacing tag' },
    { key: 'adding'   as const, label: 'Adding second tag' },
    { key: 'missing'  as const, label: 'Tag missing / unknown' },
  ]

  const needsNewTag = status === 'replacing' || status === 'adding' || status === 'missing'

  return (
    <div className="flex flex-col gap-4">
      {/* Current tag info */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <EarTagDot color={animal.ear_tag_color} size="sm" />
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
            #{animal.tag_number}
          </p>
          {animal.ear_tag_color && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current: {animal.ear_tag_color}</p>
          )}
        </div>
      </div>

      <p className="type-section-label">TAG STATUS</p>
      {StatusOpts.map(opt => (
        <button key={opt.key} onClick={() => onChange({ tag_status: opt.key })}
          className="flex items-center gap-3 px-4 rounded-2xl w-full text-left"
          style={{
            backgroundColor: status === opt.key ? 'var(--accent-soft)' : 'var(--surface-1)',
            border: `2px solid ${status === opt.key ? 'var(--accent-border)' : 'var(--border)'}`,
            minHeight: 56,
          }}>
          <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
            style={{ border: `2px solid ${status === opt.key ? 'var(--accent)' : 'var(--border-strong)'}` }}>
            {status === opt.key && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--accent)' }} />}
          </div>
          <span style={{ color: status === opt.key ? 'var(--accent)' : 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>
            {opt.label}
          </span>
        </button>
      ))}

      {needsNewTag && (
        <div className="flex flex-col gap-3 pl-2">
          <div>
            <p className="type-section-label mb-2">NEW TAG COLOR</p>
            <div className="flex flex-wrap gap-2">
              {EAR_TAG_COLORS.map(c => (
                <button key={c} onClick={() => onChange({ new_tag_color: c })}
                  className="w-9 h-9 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: COLOR_HEX[c] ?? '#888',
                    borderColor: newColor === c ? 'var(--accent)' : 'transparent',
                    boxShadow: newColor === c ? '0 0 0 2px var(--accent)' : 'none',
                  }} />
              ))}
            </div>
          </div>
          <div>
            <p className="type-section-label mb-2">NEW TAG NUMBER</p>
            <input type="text" value={newTag} onChange={e => onChange({ new_tag_number: e.target.value })}
              placeholder="New tag number"
              className="w-full px-4 rounded-2xl text-center font-bold"
              style={{
                backgroundColor: 'var(--surface-1)', border: '2px solid var(--border-strong)',
                color: 'var(--text)', fontSize: '1.75rem', fontFamily: 'var(--font-display)', minHeight: 60,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tasks Screen ──────────────────────────────────────────────────────────────

function TasksScreen({
  animal, applicableTasks, taskIndex, taskData,
  onTaskDataChange, onNext, onSkip, onReview,
}: {
  animal: AnimalLookup; applicableTasks: TaskType[]; taskIndex: number
  taskData: TaskDataEntry; onTaskDataChange: (d: TaskDataEntry) => void
  onNext: () => void; onSkip: () => void; onReview: () => void
}) {
  const currentTask = applicableTasks[taskIndex]
  const isLast      = taskIndex === applicableTasks.length - 1

  const patch = (p: Partial<TaskDataEntry>) => onTaskDataChange({ ...taskData, ...p })

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <EarTagDot color={animal.ear_tag_color} size="sm" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
            #{animal.tag_number}
          </span>
          {animal.name && (
            <span className="truncate" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{animal.name}</span>
          )}
          {animal.sex && (
            <span className="type-data-sm shrink-0" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{animal.sex}</span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {taskIndex + 1} / {applicableTasks.length}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 py-3 shrink-0">
        {applicableTasks.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-200"
            style={{
              width: i === taskIndex ? 24 : 8, height: 8,
              backgroundColor: i < taskIndex ? 'var(--success-fg)' : i === taskIndex ? 'var(--accent)' : 'var(--surface-3)',
            }} />
        ))}
      </div>

      {/* Task label */}
      <div className="px-5 pb-4 shrink-0">
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>TASK</p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)', letterSpacing: '0.02em' }}>
          {TASK_LABEL[currentTask]}
        </p>
      </div>

      {/* Task form */}
      <div className="flex-1 overflow-y-auto px-5">
        {currentTask === 'weights'    && <WeightTask   value={taskData} onChange={patch} />}
        {currentTask === 'breeding'   && <BreedingTask value={taskData} onChange={patch} />}
        {currentTask === 'preg_check' && <PregCheckTask value={taskData} onChange={patch} />}
        {currentTask === 'working'    && <WorkingTask  value={taskData} onChange={patch} />}
        {currentTask === 'health'     && <HealthTask   value={taskData} onChange={patch} />}
        {currentTask === 'ear_tags'   && <EarTagsTask  animal={animal} value={taskData} onChange={patch} />}
      </div>

      {/* Footer nav */}
      <div className="flex gap-3 p-4 border-t shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-1)' }}>
        <button onClick={onSkip}
          className="flex-1 rounded-[var(--radius-lg)] type-body font-semibold"
          style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', minHeight: 56 }}>
          SKIP
        </button>
        <button onClick={isLast ? onReview : onNext}
          className="rounded-[var(--radius-lg)] type-body font-bold flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--accent)', color: 'white', flex: 2, minHeight: 56 }}>
          {isLast ? 'REVIEW' : 'NEXT'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ── Confirm Screen ────────────────────────────────────────────────────────────

function ConfirmScreen({
  animal, applicableTasks, taskData, lastProcessed, saving, error,
  onSave, onBack, onSkipAnimal, onUndo,
}: {
  animal: AnimalLookup; applicableTasks: TaskType[]; taskData: TaskDataEntry
  lastProcessed: ProcessedAnimal | null
  saving: boolean; error: string
  onSave: () => void; onBack: () => void; onSkipAnimal: () => void; onUndo: () => void
}) {
  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        <button onClick={onBack} style={{ color: 'var(--text-muted)' }}>
          <X size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <EarTagDot color={animal.ear_tag_color} size="sm" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>
            #{animal.tag_number}
          </span>
          {animal.sex && (
            <span className="type-data-sm" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{animal.sex}</span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>CONFIRM</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {/* Task summary rows */}
        {applicableTasks.map(task => {
          const summary = taskSummaryText(task, taskData)
          const skipped = summary === null
          const EMOJIS: Record<TaskType, string> = {
            weights: '⚖️', breeding: '🐂', preg_check: '🔍',
            working: '💉', health: '🏥', ear_tags: '🏷️',
          }
          return (
            <div key={task}
              className="flex items-center justify-between px-4 rounded-[var(--radius-lg)]"
              style={{
                backgroundColor: skipped ? 'var(--surface-1)' : 'var(--surface-2)',
                border: `1px solid ${skipped ? 'var(--border)' : 'var(--border-strong)'}`,
                minHeight: 60,
              }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '1.1rem' }}>{EMOJIS[task]}</span>
                <span style={{ color: skipped ? 'var(--text-muted)' : 'var(--text)', fontWeight: 500, fontSize: '0.9rem' }}>
                  {TASK_LABEL[task]}
                </span>
              </div>
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

        {error && (
          <p className="type-helper px-4 py-3 rounded-[var(--radius-md)]"
            style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 pb-10 flex flex-col gap-3 shrink-0">
        {/* Primary: Save */}
        <button onClick={onSave} disabled={saving}
          className="w-full rounded-2xl type-body font-bold tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--accent)', color: 'white', fontSize: '1rem', minHeight: 64 }}>
          {saving ? 'SAVING…' : (
            <><CheckCircle size={18} /> SAVE &amp; NEXT ANIMAL →</>
          )}
        </button>

        {/* Undo previous */}
        {lastProcessed && (
          <button onClick={onUndo}
            className="w-full rounded-2xl type-body font-semibold flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', minHeight: 56,
            }}>
            <Undo2 size={16} />
            UNDO #{lastProcessed.animal.tag_number}
          </button>
        )}

        {/* Secondary */}
        <div className="flex gap-2">
          <button onClick={onBack}
            className="flex-1 rounded-xl type-data-sm"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', minHeight: 44 }}>
            ✏️ Edit
          </button>
          <button onClick={onSkipAnimal}
            className="flex-1 rounded-xl type-data-sm"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', minHeight: 44 }}>
            ⏭ Skip Animal
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Session Summary ───────────────────────────────────────────────────────────

function SummaryScreen({
  processed, selectedTasks, onFinish,
}: {
  processed: ProcessedAnimal[]
  selectedTasks: TaskType[]
  onFinish: () => void
}) {
  const router = useRouter()
  const [expenseAmt,  setExpenseAmt]  = useState('')
  const [expenseSaved, setExpenseSaved] = useState(false)
  const [expenseSaving, setExpenseSaving] = useState(false)

  const hasWorking = selectedTasks.includes('working') && processed.some(p => (p.taskData.working_items?.length ?? 0) > 0)

  // Stats
  const weightCount = processed.filter(p => p.taskData.weight_lbs).length
  const bredCount   = processed.filter(p => p.taskData.sire_name_text || p.taskData.natural_service).length
  const confirmed   = processed.filter(p => p.taskData.preg_result === 'confirmed').length
  const open        = processed.filter(p => p.taskData.preg_result === 'open').length
  const pregChecks  = processed.filter(p => p.taskData.preg_result != null).length

  // Straw usage summary
  const strawMap = new Map<string, { sire_name: string; used: number; prev: number }>()
  for (const p of processed) {
    if (p.strawsUsed) {
      const { semen_inventory_id, sire_name, prev_count } = p.strawsUsed
      const entry = strawMap.get(semen_inventory_id) ?? { sire_name, used: 0, prev: prev_count }
      entry.used += 1
      strawMap.set(semen_inventory_id, entry)
    }
  }

  const allWorkingItems = processed.flatMap(p => p.taskData.working_items ?? [])
  const uniqueWorkingItems = [...new Set(allWorkingItems)]

  const handleSaveExpense = async () => {
    const amt = parseFloat(expenseAmt)
    if (isNaN(amt) || amt <= 0) return
    setExpenseSaving(true)
    try {
      await apiPost('/api/expenses', {
        category_name: 'Working Animals',
        total_amount: amt,
        is_lease_specific: false,
        description: uniqueWorkingItems.join(', ') || 'Working animals session',
        expense_date: new Date().toISOString().slice(0, 10),
      })
      setExpenseSaved(true)
    } catch { /* silent */ } finally {
      setExpenseSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      <div className="flex items-center justify-center h-14 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', color: 'var(--text)' }}>
          SESSION COMPLETE 🎉
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Animals Worked', value: processed.length },
            { label: 'Weights Logged', value: weightCount },
            { label: 'Bred',           value: bredCount },
            { label: 'Straws Used',    value: strawMap.size > 0 ? [...strawMap.values()].reduce((a, e) => a + e.used, 0) : 0 },
            { label: 'Preg Checks',    value: pregChecks },
            { label: 'Confirmed',      value: confirmed },
            { label: 'Open',           value: open },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-4 py-3 flex flex-col"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em' }}>{s.label.toUpperCase()}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2rem', color: 'var(--accent)' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Straw count summary */}
        {strawMap.size > 0 && (
          <div>
            <p className="type-section-label mb-2">STRAW USAGE</p>
            {[...strawMap.entries()].map(([id, entry]) => (
              <div key={id} className="flex items-center justify-between px-4 rounded-[var(--radius-lg)] mb-2"
                style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', minHeight: 48 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{entry.sire_name}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', color: entry.prev - entry.used === 0 ? 'var(--danger-fg)' : 'var(--text-muted)' }}>
                  {entry.prev} → {entry.prev - entry.used} ({entry.used} used{entry.prev - entry.used === 0 ? ' — OUT' : ''})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Working animals expense */}
        {hasWorking && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--info-bg)', border: '1px solid var(--info-border)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--info-fg)', fontSize: '0.8rem', marginBottom: 4 }}>
              WORKING ANIMALS EXPENSE
            </p>
            <p style={{ color: 'var(--info-fg)', fontSize: '0.85rem', marginBottom: 12 }}>
              Total cost for working animals today ({processed.length} head)?
            </p>
            {expenseSaved ? (
              <div className="flex items-center gap-2">
                <CheckCircle size={16} style={{ color: 'var(--success-fg)' }} />
                <span style={{ color: 'var(--success-fg)', fontWeight: 600 }}>Expense saved</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1 px-3 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>$</span>
                  <input type="number" value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)}
                    placeholder="0.00" inputMode="decimal"
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--text)', fontSize: '1rem', minHeight: 44 }} />
                </div>
                <button onClick={handleSaveExpense} disabled={expenseSaving || !expenseAmt}
                  className="px-4 rounded-xl font-bold disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent)', color: 'white', minHeight: 44, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                  {expenseSaving ? '…' : 'SAVE'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Animal list */}
        <div>
          <p className="type-section-label mb-2">ANIMALS WORKED</p>
          {processed.map(p => (
            <div key={p.animal.id} className="rounded-[var(--radius-lg)] overflow-hidden mb-2"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
                <EarTagDot color={p.animal.ear_tag_color} size="sm" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)' }}>
                  #{p.animal.tag_number}
                </span>
                {p.animal.sex && (
                  <span className="type-data-sm ml-auto" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.animal.sex}</span>
                )}
              </div>
              <div className="px-4 py-2 flex flex-col gap-1">
                {p.applicableTasks.map(task => {
                  const s = taskSummaryText(task, p.taskData)
                  return (
                    <div key={task} className="flex justify-between type-helper">
                      <span style={{ color: 'var(--text-muted)' }}>{TASK_LABEL[task]}</span>
                      <span style={{ color: s ? 'var(--success-fg)' : 'var(--text-muted)', fontWeight: s ? 600 : 400 }}>
                        {s ?? '—'}
                      </span>
                    </div>
                  )
                })}
                {p.error && <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{p.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 pb-10 flex flex-col gap-2 shrink-0">
        <button onClick={() => router.push('/reproduction')}
          className="w-full rounded-[var(--radius-lg)] type-body font-semibold"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', minHeight: 48 }}>
          VIEW REPRO RECORDS
        </button>
        <button onClick={onFinish}
          className="w-full rounded-[var(--radius-lg)] type-body font-bold tracking-widest"
          style={{ backgroundColor: 'var(--accent)', color: 'white', fontSize: '1rem', minHeight: 56 }}>
          RETURN TO DASHBOARD
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChutePage() {
  const router = useRouter()

  const [screen,           setScreen]           = useState<Screen>('setup')
  const [tasks,            setTasks]            = useState<TaskType[]>(['breeding', 'weights'])
  const [animalFilter,     setAnimalFilter]     = useState<AnimalFilter>('all')
  const [leaseId,          setLeaseId]          = useState<string | null>(null)
  const [technician,       setTechnician]       = useState('')
  const [date,             setDate]             = useState(today)
  const [resumeSession,    setResumeSession]    = useState<ChuteSession | null>(null)
  const [aiTechFeePerCow,    setAiTechFeePerCow]    = useState(0)
  const [aiPregCheckDaysOut, setAiPregCheckDaysOut] = useState(45)

  const [currentAnimal,    setCurrentAnimal]    = useState<AnimalLookup | null>(null)
  const [applicableTasks,  setApplicableTasks]  = useState<TaskType[]>([])
  const [taskIndex,        setTaskIndex]        = useState(0)
  const [taskData,         setTaskData]         = useState<TaskDataEntry>({})
  const [processed,        setProcessed]        = useState<ProcessedAnimal[]>([])
  const [saving,           setSaving]           = useState(false)
  const [saveError,        setSaveError]        = useState('')
  const [currentRepro,     setCurrentRepro]     = useState<ReproStatusResult | null>(null)
  const [overrideDialog,   setOverrideDialog]   = useState<'confirm' | 'straw' | null>(null)
  const [overrideReturnStraw, setOverrideReturnStraw] = useState(false)

  // Check for existing session + restore technician on mount
  useEffect(() => {
    const existing = loadSession()
    if (existing) setResumeSession(existing)
    try { const t = localStorage.getItem(TECH_KEY); if (t) setTechnician(t) } catch {}
    apiGet('/api/settings/ranch').then(r => r.json()).then(j => {
      const s = j.data ?? {}
      if (s.ai_tech_fee_per_cow    != null) setAiTechFeePerCow(parseFloat(s.ai_tech_fee_per_cow) || 0)
      if (s.ai_preg_check_days_out != null) setAiPregCheckDaysOut(parseInt(s.ai_preg_check_days_out, 10) || 45)
      if (s.default_ai_technician)  setTechnician(prev => prev || s.default_ai_technician)
    }).catch(() => {})
  }, [])

  const handleStart = () => {
    const session: ChuteSession = {
      tasks, animalFilter, leaseId, technician,
      date, startedAt: new Date().toISOString(),
    }
    saveSession(session)
    setScreen('animal')
  }

  const handleResume = () => {
    if (!resumeSession) return
    setTasks(resumeSession.tasks)
    setAnimalFilter(resumeSession.animalFilter)
    setLeaseId(resumeSession.leaseId)
    setTechnician(resumeSession.technician)
    setDate(resumeSession.date)
    setResumeSession(null)
    setScreen('animal')
  }

  const handleFresh = () => {
    clearSession()
    setResumeSession(null)
  }

  const handleAnimalLoaded = async (animal: AnimalLookup) => {
    const applicable = TASK_ORDER.filter(t => tasks.includes(t) && taskApplies(t, animal.sex))
    setCurrentAnimal(animal)
    setApplicableTasks(applicable)
    setTaskIndex(0)
    setTaskData({})
    setSaveError('')
    setCurrentRepro(null)
    setOverrideDialog(null)

    if (applicable.includes('breeding')) {
      try {
        const res = await apiGet(`/api/reproduction?animal_id=${animal.id}&limit=50`)
        const j = await res.json()
        const repro = deriveReproStatus(
          { sex: animal.sex, dob: animal.dob, breeding_eligible: animal.breeding_eligible },
          (j.data ?? []).map((e: { id: string; event_type: string; event_date: string; preg_check_result?: string | null; sire_name_text?: string | null; sire_library?: { bull_name?: string | null } | null; sire_library_id?: string | null; semen_inventory_id?: string | null; expected_calving_date?: string | null }) => e),
        )
        setCurrentRepro(repro)
        if (!repro.breedable && (repro.status === 'bred' || repro.status === 'confirmed' || repro.status === 'recheck')) {
          setOverrideDialog('confirm')
          setScreen('tasks')
          return
        }
      } catch {
        // non-fatal — proceed without guard
      }
    }

    if (applicable.length === 0) setScreen('confirm')
    else setScreen('tasks')
  }

  const handleTaskSkip = () => {
    if (taskIndex < applicableTasks.length - 1) setTaskIndex(i => i + 1)
    else setScreen('confirm')
  }

  const handleTaskNext = () => {
    if (taskIndex < applicableTasks.length - 1) setTaskIndex(i => i + 1)
    else setScreen('confirm')
  }

  const handleSave = async () => {
    if (!currentAnimal) return
    setSaving(true); setSaveError('')

    const savedEvents: SavedEvent[] = []
    const extraDeleteUrls: string[] = []
    let error = ''
    let strawsUsed: StrawsUsedEntry | undefined

    try {
      const promises: Promise<void>[] = []

      // WEIGHTS
      if (taskData.weight_lbs && applicableTasks.includes('weights')) {
        promises.push((async () => {
          const res = await apiPost(`/api/animals/${currentAnimal.id}/weights`, {
            weight_lbs: taskData.weight_lbs, weighed_at: date, source: 'manual',
            notes: taskData.weight_estimated ? 'Estimated' : null,
          })
          const j = await res.json()
          if (j.id) savedEvents.push({ task: 'weights', deleteUrl: `/api/animals/${currentAnimal.id}/weights/${j.id}` })
        })())
      }

      // BREEDING
      if (applicableTasks.includes('breeding') && !taskData.not_bred && (taskData.semen_inventory_id || taskData.natural_service)) {
        promises.push((async () => {
          // If overriding an existing bred cycle, delete old event first
          if (currentRepro?.lastBred?.eventId) {
            const oldEventId = currentRepro.lastBred.eventId
            const oldInvId   = currentRepro.lastBred.semenInventoryId
            await apiDelete(`/api/reproduction/${oldEventId}`)
            // Optionally return straw to inventory
            if (overrideReturnStraw && oldInvId) {
              const tankRes  = await apiGet('/api/genetics/tank')
              const tankJson = await tankRes.json()
              const oldStraw = (tankJson.data ?? []).find((s: SemenStraw) => s.id === oldInvId)
              if (oldStraw) {
                await apiPatch('/api/genetics/tank', { id: oldInvId, straw_count: (oldStraw.straw_count ?? 0) + 1 })
              }
            }
          }

          let straw: SemenStraw | undefined
          let pricePerStraw = 0

          // Deduct straw from inventory
          if (taskData.semen_inventory_id) {
            const tankRes  = await apiGet('/api/genetics/tank')
            const tankJson = await tankRes.json()
            straw = (tankJson.data ?? []).find((s: SemenStraw) => s.id === taskData.semen_inventory_id)
            if (straw && straw.straw_count > 0) {
              await fetch('/api/genetics/tank', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: straw.id, straw_count: straw.straw_count - 1 }),
              })
              strawsUsed   = { semen_inventory_id: straw.id, sire_name: straw.sire_name, prev_count: straw.straw_count }
              pricePerStraw = straw.price_per_straw ?? 0
            }
          }

          const isAi = !taskData.natural_service
          const res = await apiPost('/api/reproduction', {
            animal_id:             currentAnimal.id,
            event_type:            'bred',
            event_date:            date,
            conception_method:     isAi ? 'ai' : 'natural',
            sire_name_text:        taskData.sire_name_text     || null,
            sire_library_id:       taskData.sire_library_id    || null,
            semen_inventory_id:    taskData.semen_inventory_id || null,
            ai_technician:         technician                  || null,
            ai_cost:               isAi && aiTechFeePerCow > 0 ? aiTechFeePerCow : null,
            straw_cost:            pricePerStraw > 0            ? pricePerStraw   : null,
            expected_calving_date: addDays(date, 283),
          })
          const j = await res.json()
          const newEventId = j.data?.id ?? null
          if (newEventId) savedEvents.push({ task: 'breeding', deleteUrl: `/api/reproduction/${newEventId}` })

          // Preg-check reminder for all breedings (AI and natural service)
          const pregCheckDue = addDays(date, aiPregCheckDaysOut)
          const tagLabel     = `${currentAnimal.ear_tag_color ?? ''} ${currentAnimal.tag_number}`.trim()
          await apiPost('/api/reminders', {
            animal_id:             currentAnimal.id,
            reminder_type:         'preg_check',
            due_date:              pregCheckDue,
            title:                 `Preg check — ${tagLabel}`,
            reproduction_event_id: newEventId,
          })

          if (isAi) {
            // Owner-specific expenses for animals with an owner
            if (currentAnimal.owner_id) {
              const qtr      = Math.ceil((new Date(date).getMonth() + 1) / 3)
              const yr       = new Date(date).getFullYear() % 100
              const bullName = taskData.sire_name_text || straw?.sire_name || 'AI breeding'

              const expensePosts: Promise<Response>[] = []
              if (aiTechFeePerCow > 0) {
                expensePosts.push(apiPost('/api/expenses', {
                  category_name:        'AI Technician Fee',
                  expense_type:         'owner_specific',
                  owner_id:             currentAnimal.owner_id,
                  total_amount:         aiTechFeePerCow,
                  expense_date:         date,
                  quarter:              qtr,
                  year:                 yr,
                  description:          `AI Tech Fee — ${bullName}`,
                  is_lease_specific:    false,
                  reproduction_event_id: newEventId,
                }))
              }
              if (pricePerStraw > 0) {
                expensePosts.push(apiPost('/api/expenses', {
                  category_name:        'Semen Straws',
                  expense_type:         'owner_specific',
                  owner_id:             currentAnimal.owner_id,
                  total_amount:         pricePerStraw,
                  expense_date:         date,
                  quarter:              qtr,
                  year:                 yr,
                  description:          `${bullName} semen straw`,
                  sire_library_id:      taskData.sire_library_id || straw?.sire_library_id || null,
                  is_lease_specific:    false,
                  reproduction_event_id: newEventId,
                }))
              }
              if (expensePosts.length) {
                const expenseResults = await Promise.all(expensePosts.map(p => p.then(r => r.json())))
                for (const r of expenseResults) {
                  if (r.data?.id) extraDeleteUrls.push(`/api/expenses/${r.data.id}`)
                }
              }
            }
          }
        })())
      }

      // PREG CHECK
      if (applicableTasks.includes('preg_check') && taskData.preg_result !== undefined) {
        if (taskData.preg_result !== null) {
          promises.push((async () => {
            const res = await apiPost('/api/reproduction', {
              animal_id: currentAnimal.id, event_type: 'preg_check', event_date: date,
              preg_check_result: taskData.preg_result,
              preg_check_method: taskData.preg_method ?? 'ultrasound',
              notes: taskData.preg_decision ? `Decision: ${taskData.preg_decision}` : null,
            })
            const j = await res.json()
            if (j.data?.id) savedEvents.push({ task: 'preg_check', deleteUrl: `/api/reproduction/${j.data.id}` })
          })())
        }
      }

      // HEALTH
      if (applicableTasks.includes('health') && (taskData.health_drug || taskData.health_type)) {
        promises.push((async () => {
          const res = await apiPost('/api/health', {
            animal_id: currentAnimal.id,
            event_type: taskData.health_type ?? 'treatment',
            event_date: date,
            drug_name:   taskData.health_drug  || null,
            dose_amount: taskData.health_dose  || null,
            dose_unit:   taskData.health_unit  || null,
            administered_by: technician || null,
          })
          const j = await res.json()
          if (j.data?.id) savedEvents.push({ task: 'health', deleteUrl: `/api/health/${j.data.id}` })
        })())
      }

      // EAR TAGS (PATCH animal if replacing/adding/missing)
      if (applicableTasks.includes('ear_tags') && taskData.tag_status && taskData.tag_status !== 'ok' && taskData.new_tag_number) {
        promises.push((async () => {
          await fetch(`/api/animals/${currentAnimal.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              tag_number: taskData.new_tag_number,
              ear_tag_color: taskData.new_tag_color ?? currentAnimal.ear_tag_color,
            }),
          })
        })())
      }

      await Promise.all(promises)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Save failed'
    }

    setSaving(false)
    if (error) { setSaveError(error); return }

    const entry: ProcessedAnimal = {
      animal: currentAnimal, taskData, savedEvents, applicableTasks, strawsUsed,
      extraDeleteUrls: extraDeleteUrls.length ? extraDeleteUrls : undefined,
    }
    setProcessed(prev => [...prev, entry])
    setCurrentAnimal(null); setTaskData({}); setCurrentRepro(null); setOverrideDialog(null); setOverrideReturnStraw(false); setScreen('animal')
  }

  const handleUndo = async () => {
    const last = processed[processed.length - 1]
    if (!last) return
    setProcessed(prev => prev.slice(0, -1))
    // Restore straw
    if (last.strawsUsed) {
      await fetch('/api/genetics/tank', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: last.strawsUsed.semen_inventory_id, straw_count: last.strawsUsed.prev_count }),
      }).catch(() => {})
    }
    await Promise.allSettled(last.savedEvents.map(e => apiDelete(e.deleteUrl)))
    if (last.extraDeleteUrls?.length) {
      await Promise.allSettled(last.extraDeleteUrls.map(url => apiDelete(url)))
    }
  }

  const lastProcessed = processed.length > 0 ? processed[processed.length - 1] : null

  // Resume prompt overlay
  if (resumeSession) {
    const t = new Date(resumeSession.startedAt)
    const timeStr = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8"
        style={{ backgroundColor: '#0a0a0a' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent)', marginBottom: 8 }}>
          CHUTE MODE
        </div>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 32, textAlign: 'center' }}>
          You have a session from {timeStr}.<br />Continue where you left off?
        </p>
        <button onClick={handleResume}
          className="w-full max-w-xs rounded-2xl font-bold mb-3"
          style={{ backgroundColor: 'var(--accent)', color: 'white', minHeight: 56, fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.08em' }}>
          YES — RESUME SESSION
        </button>
        <button onClick={handleFresh}
          className="w-full max-w-xs rounded-2xl font-bold"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', minHeight: 56 }}>
          START FRESH
        </button>
      </div>
    )
  }

  return (
    <>
      {screen === 'setup' && (
        <SetupScreen
          tasks={tasks} setTasks={setTasks}
          animalFilter={animalFilter} setAnimalFilter={setAnimalFilter}
          leaseId={leaseId} setLeaseId={setLeaseId}
          technician={technician} setTechnician={setTechnician}
          date={date} setDate={setDate}
          onStart={handleStart}
        />
      )}

      {screen === 'animal' && (
        <AnimalScreen
          processed={processed}
          sessionDate={date}
          onAnimalLoaded={handleAnimalLoaded}
          onDone={() => setScreen('summary')}
          onExit={() => setScreen('summary')}
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
          onReview={() => setScreen('confirm')}
        />
      )}

      {screen === 'confirm' && currentAnimal && (
        <ConfirmScreen
          animal={currentAnimal}
          applicableTasks={applicableTasks}
          taskData={taskData}
          lastProcessed={lastProcessed}
          saving={saving}
          error={saveError}
          onSave={handleSave}
          onBack={() => {
            setTaskIndex(Math.max(0, applicableTasks.length - 1))
            setScreen(applicableTasks.length > 0 ? 'tasks' : 'animal')
          }}
          onSkipAnimal={() => { setCurrentAnimal(null); setScreen('animal') }}
          onUndo={handleUndo}
        />
      )}

      {screen === 'summary' && (
        <SummaryScreen
          processed={processed}
          selectedTasks={tasks}
          onFinish={() => { clearSession(); router.push('/dashboard') }}
        />
      )}

      {/* Re-breed guard: step 1 — confirm override */}
      {overrideDialog === 'confirm' && currentAnimal && currentRepro && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <div className="w-full max-w-sm flex flex-col gap-5">
            <div className="text-center">
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⚠️</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.05em', marginBottom: 8 }}>
                ALREADY {currentRepro.status.toUpperCase()}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                #{currentAnimal.tag_number} is <strong style={{ color: '#f59e0b' }}>{currentRepro.status}</strong>
                {currentRepro.lastBred ? ` — bred to ${currentRepro.lastBred.sireName ?? 'unknown'} on ${new Date(currentRepro.lastBred.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.
              </p>
            </div>
            <button
              onClick={() => {
                if (currentRepro.lastBred?.semenInventoryId) {
                  setOverrideDialog('straw')
                } else {
                  setOverrideReturnStraw(false)
                  setOverrideDialog(null)
                }
              }}
              className="w-full rounded-2xl font-bold"
              style={{ backgroundColor: '#f59e0b', color: '#000', minHeight: 64, fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.08em' }}>
              OVERRIDE — REMOVE PREVIOUS
            </button>
            <button
              onClick={() => {
                setOverrideDialog(null)
                setTaskData(prev => ({ ...prev, not_bred: true }))
                handleTaskNext()
              }}
              className="w-full rounded-2xl font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', minHeight: 64 }}>
              SKIP BREEDING
            </button>
          </div>
        </div>
      )}

      {/* Re-breed guard: step 2 — straw disposition */}
      {overrideDialog === 'straw' && currentAnimal && currentRepro?.lastBred?.semenInventoryId && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <div className="w-full max-w-sm flex flex-col gap-5">
            <div className="text-center">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em', marginBottom: 8 }}>
                RETURN ORIGINAL STRAW?
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                The previous breeding used a straw from inventory. Return it?
              </p>
            </div>
            <button
              onClick={() => { setOverrideReturnStraw(true); setOverrideDialog(null) }}
              className="w-full rounded-2xl font-bold"
              style={{ backgroundColor: 'var(--accent)', color: 'white', minHeight: 64, fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.08em' }}>
              YES — RETURN STRAW (+1)
            </button>
            <button
              onClick={() => { setOverrideReturnStraw(false); setOverrideDialog(null) }}
              className="w-full rounded-2xl font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', minHeight: 64 }}>
              NO — DISCARD STRAW
            </button>
          </div>
        </div>
      )}

    </>
  )
}
