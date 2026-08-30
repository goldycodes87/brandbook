// Everything that has to happen AFTER a preg check is recorded.
//
// Recording the event is the easy half. The half that gets forgotten is
// closing the reminder that prompted the check and opening the next one, and
// it was forgotten: PregCheckSheet did it, chute mode did not, so 11 of the 12
// checks on 2026-08-28 left their reminder standing and created no calving
// reminder. Both callers now run this, so a check logged at the chute and one
// logged from the dashboard leave the same trail.
//
// Every step is independent and reported rather than thrown: the check itself
// is already saved by the time this runs, and losing a reminder must never
// look like losing the result.

import { apiPost, apiPatch } from '@/lib/fetch'

export type PregResult = 'confirmed' | 'open' | 'recheck'
export type OpenDecision = 're-breed' | 'cull' | 'monitor'

export interface PregCheckFollowupInput {
  animalId: string
  tagNumber: string
  earTagColor?: string | null
  result: PregResult
  /** Date the check was performed — recheck and monitor count forward from it. */
  checkDate: string
  /** From the bred event. Falls back to bredDate + 283 when absent. */
  expectedCalvingDate?: string | null
  bredDate?: string | null
  /** Only meaningful when result is 'open'. */
  decision?: OpenDecision | null
}

export interface PregCheckFollowupResult {
  reminderDismissed: boolean
  calvingReminderDue: string | null
  recheckDue: string | null
  culled: boolean
  /** Human-readable failures. Empty means everything landed. */
  problems: string[]
}

/** Days from breeding to calving. */
const GESTATION_DAYS = 283
/** How far ahead of calving to raise the reminder. */
const CALVING_LEAD_DAYS = 14
const RECHECK_DAYS = 14
const MONITOR_DAYS = 30

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const label = (tag: string, color?: string | null) => `${color ?? ''} ${tag}`.trim()

export async function runPregCheckFollowup(
  input: PregCheckFollowupInput,
): Promise<PregCheckFollowupResult> {
  const { animalId, tagNumber, earTagColor, result, checkDate, decision } = input

  const out: PregCheckFollowupResult = {
    reminderDismissed: false,
    calvingReminderDue: null,
    recheckDue: null,
    culled: false,
    problems: [],
  }

  // 1. Close the reminder that prompted the check. By animal + type, so it
  //    works whether or not the caller knows the reminder's id.
  try {
    const res = await apiPatch('/api/reminders', {
      animal_id: animalId, reminder_type: 'preg_check', is_dismissed: true,
    })
    if (res.ok) out.reminderDismissed = true
    else out.problems.push('the preg-check reminder is still showing')
  } catch {
    out.problems.push('the preg-check reminder is still showing')
  }

  // 2. Open the next one.
  if (result === 'confirmed') {
    const calving = input.expectedCalvingDate
      ?? (input.bredDate ? addDays(input.bredDate, GESTATION_DAYS) : null)

    if (!calving) {
      // No breeding on file to count from. Say so rather than implying a
      // reminder was set.
      out.problems.push('no breeding date on file, so no calving reminder was set')
    } else {
      const due = addDays(calving, -CALVING_LEAD_DAYS)
      try {
        const res = await apiPost('/api/reminders', {
          animal_id: animalId, reminder_type: 'calving', due_date: due,
          title: `Calving due — ${label(tagNumber, earTagColor)}`,
        })
        if (res.ok) out.calvingReminderDue = due
        else out.problems.push('the calving reminder was not created')
      } catch {
        out.problems.push('the calving reminder was not created')
      }
    }
  }

  if (result === 'recheck') {
    const due = addDays(checkDate, RECHECK_DAYS)
    try {
      const res = await apiPost('/api/reminders', {
        animal_id: animalId, reminder_type: 'preg_check', due_date: due,
        title: `Recheck — ${label(tagNumber, earTagColor)}`,
      })
      if (res.ok) out.recheckDue = due
      else out.problems.push('the recheck reminder was not created')
    } catch {
      out.problems.push('the recheck reminder was not created')
    }
  }

  // 3. An open cow's decision.
  if (result === 'open' && decision === 'monitor') {
    const due = addDays(checkDate, MONITOR_DAYS)
    try {
      const res = await apiPost('/api/reminders', {
        animal_id: animalId, reminder_type: 'preg_check', due_date: due,
        title: `Follow up — open cow ${tagNumber}`,
      })
      if (res.ok) out.recheckDue = due
      else out.problems.push('the follow-up reminder was not created')
    } catch {
      out.problems.push('the follow-up reminder was not created')
    }
  }

  if (result === 'open' && decision === 'cull') {
    try {
      const res = await apiPost(`/api/animals/${animalId}/cull`, { reason: 'Open' })
      if (res.ok) out.culled = true
      else out.problems.push('she was not added to the cull list')
    } catch {
      out.problems.push('she was not added to the cull list')
    }
  }

  return out
}
