'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { DispositionSheet } from '@/components/animals/DispositionSheet'
import { apiPost, apiPatch } from '@/lib/fetch'
import { fmtDate } from '@/lib/format'

// ── Types ────────────────────────────────────────────────────────────────────

interface AnimalRef {
  id: string
  tag_number: string
  name: string | null
  ear_tag_color?: string | null
  sex?: string | null
  owner_id?: string | null
}

export interface PregCheckSheetProps {
  isOpen:       boolean
  onClose:      () => void
  animal:       AnimalRef
  reminderId?:  string
  bredDate?:    string
  bullName?:    string
  expectedCalvingDate?: string
  onSuccess:    () => void
}

type CheckResult = 'confirmed' | 'open' | 'recheck'
type CheckMethod = 'rectal' | 'ultrasound' | 'blood'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Open Cow Decision ────────────────────────────────────────────────────────

function OpenCowDecision({
  animal,
  onRebreed,
  onMonitor,
  onCull,
}: {
  animal: AnimalRef
  onRebreed: () => void
  onMonitor: () => void
  onCull: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <ContextBanner tone="warning">
        <strong>#{animal.tag_number}</strong>{animal.name ? ` — ${animal.name}` : ''} didn&apos;t settle. What would you like to do?
      </ContextBanner>
      <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>NEXT STEPS</p>
      {[
        { emoji: '🔄', label: 'RE-BREED', sub: 'Schedule another AI session', action: onRebreed },
        { emoji: '📋', label: 'CULL', sub: 'Record sale, death or transfer now', action: onCull },
        { emoji: '👁', label: 'MONITOR', sub: 'Watch and decide later', action: onMonitor },
      ].map(opt => (
        <button key={opt.label} type="button" onClick={opt.action}
          className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
          style={{ border: '2px solid var(--border)', background: 'var(--surface-1)' }}>
          <span className="text-2xl">{opt.emoji}</span>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{opt.label}</p>
            <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.sub}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Main Sheet ───────────────────────────────────────────────────────────────

export function PregCheckSheet({
  isOpen,
  onClose,
  animal,
  reminderId,
  bredDate,
  bullName,
  expectedCalvingDate,
  onSuccess,
}: PregCheckSheetProps) {
  const router = useRouter()

  const [checkDate,  setCheckDate]  = useState(new Date().toISOString().slice(0, 10))
  const [method,     setMethod]     = useState<CheckMethod>('ultrasound')
  const [result,     setResult]     = useState<CheckResult | null>(null)
  const [techName,   setTechName]   = useState('')
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [phase,      setPhase]      = useState<'form' | 'open_decision' | 'done'>('form')
  const [doneMsg,    setDoneMsg]    = useState('')
  const [culling,    setCulling]    = useState(false)

  function reset() {
    setCheckDate(new Date().toISOString().slice(0, 10))
    setMethod('ultrasound'); setResult(null)
    setTechName(''); setNotes('')
    setSaving(false); setError('')
    setPhase('form'); setDoneMsg(''); setCulling(false)
  }

  /**
   * A failed request RESOLVES — fetch only rejects on a network fault, so an
   * unchecked `await apiPost(...)` sails past a 500 and the sheet declares
   * success on a check that was never written. Working a chute full of cows,
   * that is invisible until the herd report comes up short months later.
   */
  async function post(url: string, body: unknown, what: string) {
    const res  = await apiPost(url, body)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error ?? `${what} failed (${res.status})`)
    }
    return res
  }

  async function handleSave() {
    if (!result) { setError('Select a result'); return }
    setSaving(true); setError('')

    try {
      // 1. The preg check itself. Nothing else happens unless this lands.
      await post('/api/reproduction', {
        animal_id:         animal.id,
        event_type:        'preg_check',
        event_date:        checkDate,
        preg_check_result: result,
        preg_check_method: method,
        notes:             notes || null,
        ai_technician:     techName || null,
      }, 'Saving the preg check')

      // 2. Dismiss the reminder. By id when we came from one, otherwise by
      //    animal so the animal-page route does not leave it standing.
      const dismissRes = await apiPatch('/api/reminders', reminderId
        ? { id: reminderId, is_dismissed: true }
        : { animal_id: animal.id, reminder_type: 'preg_check', is_dismissed: true })
      if (!dismissRes.ok) {
        // The check is saved; a stale reminder is cosmetic. Say so rather than
        // discarding a result the vet already called.
        setError('Preg check saved, but its reminder is still showing. Dismiss it by hand.')
      }

      if (result === 'confirmed') {
        const calvingDate = expectedCalvingDate ?? (bredDate ? addDays(bredDate, 283) : null)
        if (calvingDate) {
          const reminderDue = addDays(calvingDate, -14)
          await post('/api/reminders', {
            animal_id:     animal.id,
            reminder_type: 'calving',
            due_date:      reminderDue,
            title:         `Calving due — ${animal.ear_tag_color ?? ''} ${animal.tag_number}`.trim(),
          }, 'Creating the calving reminder')
          setDoneMsg(`✓ Confirmed pregnant! Expected calving: ${fmtDate(calvingDate)}`)
        } else {
          // No bred event reached this sheet, so there is no date to count
          // from. The check is saved; the calving reminder is not.
          setDoneMsg('✓ Confirmed pregnant. No breeding date on file, so no calving reminder was set.')
        }
        setPhase('done')

      } else if (result === 'open') {
        setPhase('open_decision')

      } else if (result === 'recheck') {
        const recheckDue = addDays(checkDate, 14)
        await post('/api/reminders', {
          animal_id:     animal.id,
          reminder_type: 'preg_check',
          due_date:      recheckDue,
          title:         `Recheck — ${animal.ear_tag_color ?? ''} ${animal.tag_number}`.trim(),
        }, 'Creating the recheck reminder')
        setDoneMsg(`Recheck set for ${fmtDate(recheckDue)}`)
        setPhase('done')
      }

      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — please try again.')
    } finally { setSaving(false) }
  }

  async function handleMonitor() {
    const monitorDue = addDays(checkDate, 30)
    try {
      await post('/api/reminders', {
        animal_id:     animal.id,
        reminder_type: 'preg_check',
        due_date:      monitorDue,
        title:         `Follow up — open cow ${animal.tag_number}`,
      }, 'Creating the follow-up reminder')
    } catch (e) {
      // Swallowing this used to close the sheet as though the follow-up had
      // been scheduled, and the cow was never looked at again.
      setError(e instanceof Error ? e.message : 'Could not set the follow-up reminder.')
      return
    }
    onClose(); reset()
  }

  if (!isOpen) return null

  // CULL hands off to the real disposition flow rather than a second, thinner
  // copy of it — that sheet is what records the sale or death, closes out the
  // grazing assignment and feeds Schedule F. It replaces this sheet outright
  // instead of stacking on top: two fixed overlays fight over z-index, and the
  // preg check is already saved by the time this screen is reachable.
  //
  // Backing out returns to the open-cow decision, so a mis-tap costs nothing.
  if (culling) {
    return (
      <DispositionSheet
        isOpen
        onClose={() => setCulling(false)}
        animal={{
          id:            animal.id,
          tag_number:    animal.tag_number,
          name:          animal.name,
          sex:           animal.sex ?? null,
          ear_tag_color: animal.ear_tag_color,
          owner_id:      animal.owner_id ?? null,
        }}
        onSuccess={() => { onSuccess(); onClose(); reset() }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-t-2xl md:rounded-2xl flex flex-col w-full md:max-w-lg"
        style={{ background: 'var(--surface-0)', maxHeight: '92dvh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>PREG CHECK</p>
            <div className="flex items-center gap-2 mt-0.5">
              <EarTagDot color={animal.ear_tag_color} size="md" />
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>#{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}</h2>
            </div>
            {bredDate && (
              <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Bred: {fmtDate(bredDate)}{bullName ? ` | Bull: ${bullName}` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-xl font-bold" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 pb-4 flex flex-col gap-4 overflow-y-scroll" style={{ minHeight: 0 }}>

          {/* ── FORM ────────────────────────────────────────────────────── */}
          {phase === 'form' && (
            <>
              <Field label="Date">
                <Input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} />
              </Field>

              {/* Method */}
              <div>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>METHOD</p>
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {([['rectal', 'RECTAL'], ['ultrasound', 'ULTRASOUND'], ['blood', 'BLOOD']] as [CheckMethod, string][]).map(([val, label], i, arr) => (
                    <button key={val} type="button" onClick={() => setMethod(val)}
                      className="flex-1 px-2 py-2 text-xs font-semibold"
                      style={{
                        background: method === val ? 'var(--accent)' : 'var(--surface-1)',
                        color:      method === val ? 'white' : 'var(--text-muted)',
                        borderRight: i < arr.length - 1 ? '1px solid var(--border)' : undefined,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result tiles */}
              <div>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>RESULT</p>
                <div className="flex flex-col gap-2">
                  {([
                    { val: 'confirmed' as CheckResult, emoji: '✓', label: 'CONFIRMED', sub: 'Bred', tone: 'success' },
                    { val: 'open'      as CheckResult, emoji: '✗', label: 'OPEN',      sub: 'Not bred', tone: 'danger' },
                    { val: 'recheck'   as CheckResult, emoji: '?', label: 'RECHECK',   sub: 'Uncertain', tone: 'warning' },
                  ] as const).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setResult(opt.val)}
                      className="flex items-center gap-4 p-4 rounded-xl text-left"
                      style={{
                        border:     `2px solid ${result === opt.val ? 'var(--accent)' : 'var(--border)'}`,
                        background: result === opt.val ? 'var(--accent-soft)' : 'var(--surface-1)',
                      }}>
                      <span className="text-2xl font-bold w-8 text-center"
                        style={{ color: opt.tone === 'success' ? 'var(--success-fg)' : opt.tone === 'danger' ? 'var(--danger-fg)' : '#c87a00' }}>
                        {opt.emoji}
                      </span>
                      <div>
                        <p className="font-bold" style={{ color: result === opt.val ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</p>
                        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{opt.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Vet / Tech name (optional)">
                <Input value={techName} onChange={e => setTechName(e.target.value)} placeholder="Name" />
              </Field>

              <Field label="Notes (optional)">
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations…" />
              </Field>

              {error && <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>{error}</p>}
            </>
          )}

          {/* ── OPEN COW DECISION ───────────────────────────────────────── */}
          {phase === 'open_decision' && (
            <OpenCowDecision
              animal={animal}
              onRebreed={() => { onClose(); reset(); router.push(`/reproduction/ai-session`) }}
              onMonitor={handleMonitor}
              onCull={() => setCulling(true)}
            />
          )}

          {/* ── DONE ────────────────────────────────────────────────────── */}
          {phase === 'done' && (
            <div className="rounded-xl p-5" style={{ background: 'var(--success-bg)', border: '2px solid var(--success-fg)' }}>
              <p className="font-bold" style={{ color: 'var(--success-fg)' }}>{doneMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" size="sm" onClick={() => { onClose(); reset() }}>
            {phase === 'done' ? 'CLOSE' : 'CANCEL'}
          </Button>
          {phase === 'form' && (
            <Button type="button" intent="primary" size="sm" className="flex-1" loading={saving} disabled={!result} onClick={handleSave}>
              SAVE PREG CHECK
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
