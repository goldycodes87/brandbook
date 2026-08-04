// Single source of truth for reproductive status derivation.
// Used in server components (animals/page.tsx) and client components (animals/[id]/page.tsx).

export type ReproStatus =
  | 'open'
  | 'bred'
  | 'confirmed'
  | 'recheck'
  | 'fresh_postpartum'
  | 'too_young'
  | 'held_back'
  | 'not_applicable'

export interface ReproStatusResult {
  status: ReproStatus
  breedable: boolean
  blockReason: string | null
  lastBred: {
    date: string
    sireName: string | null
    semenInventoryId: string | null
    sireLibraryId: string | null
    eventId: string | null
  } | null
  lastPregCheckResult: string | null
  lastPregCheckDate: string | null
  lastCalvedDate: string | null
  expectedCalvingDate: string | null
  daysSinceBred: number | null
  daysSinceCalved: number | null
}

export interface AnimalForRepro {
  sex?: string | null
  dob?: string | null
  breeding_eligible?: boolean | null
}

export interface ReproEventForStatus {
  id?: string
  event_type: string
  event_date: string
  preg_check_result?: string | null
  sire_name_text?: string | null
  sire_library?: { bull_name?: string | null } | null
  sire_library_id?: string | null
  semen_inventory_id?: string | null
  expected_calving_date?: string | null
}

function addDaysTo(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function daysDiff(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

const ZERO: ReproStatusResult = {
  status: 'not_applicable',
  breedable: false,
  blockReason: null,
  lastBred: null,
  lastPregCheckResult: null,
  lastPregCheckDate: null,
  lastCalvedDate: null,
  expectedCalvingDate: null,
  daysSinceBred: null,
  daysSinceCalved: null,
}

/**
 * Derive reproductive status from an animal's attributes and event history.
 *
 * Rules (applied in order):
 * 1. Non-female sex → not_applicable, breedable false
 * 2. Active breeding cycle (bred event with no calving after it):
 *    - confirmed preg check → confirmed, breedable false
 *    - recheck preg check   → recheck,   breedable false
 *    - open preg check      → fall through to open
 *    - no preg check        → bred,       breedable false
 * 3. Postpartum: calved with no bred after it:
 *    - < 45 days since calving → fresh_postpartum, breedable false
 *    - ≥ 45 days              → fall through to open/heifer gate
 * 4. Heifer gate (when otherwise breedable):
 *    - age < 12 months (dob known) → too_young,   breedable false
 *    - breeding_eligible === false  → held_back,   breedable false
 * 5. Otherwise → open, breedable true
 */
export function deriveReproStatus(
  animal: AnimalForRepro,
  events: ReproEventForStatus[],
  today: Date = new Date(),
): ReproStatusResult {
  const sex = animal.sex?.toLowerCase()
  if (sex !== 'cow' && sex !== 'heifer') return { ...ZERO }

  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.event_date + 'T00:00:00').getTime() -
      new Date(a.event_date + 'T00:00:00').getTime(),
  )

  const latestBred   = sorted.find(e => e.event_type === 'bred')   ?? null
  const latestCalved = sorted.find(e => e.event_type === 'calved') ?? null

  const latestBredDate = latestBred?.event_date ?? null
  const lastCalvedDate = latestCalved?.event_date ?? null

  const daysSinceBred   = latestBredDate
    ? daysDiff(new Date(latestBredDate + 'T00:00:00'), today) : null
  const daysSinceCalved = lastCalvedDate
    ? daysDiff(new Date(lastCalvedDate + 'T00:00:00'), today) : null

  const sireName = latestBred?.sire_library?.bull_name ?? latestBred?.sire_name_text ?? null
  const lastBredResult = latestBred ? {
    date:             latestBred.event_date,
    sireName,
    semenInventoryId: latestBred.semen_inventory_id ?? null,
    sireLibraryId:    latestBred.sire_library_id    ?? null,
    eventId:          latestBred.id                 ?? null,
  } : null

  // Is there a bred event more recent than the latest calving?
  const hasActiveBredCycle =
    latestBred !== null &&
    (latestCalved === null ||
     new Date(latestBred.event_date + 'T00:00:00') > new Date(latestCalved.event_date + 'T00:00:00'))

  // Hoist so the open fallthrough return can reference them
  let pcAfterBred: ReproEventForStatus | null = null
  let openFallthrough = false

  if (hasActiveBredCycle && latestBred) {
    // Most recent preg check on or after the bred event
    pcAfterBred = sorted.find(
      e =>
        e.event_type === 'preg_check' &&
        new Date(e.event_date + 'T00:00:00') >= new Date(latestBred.event_date + 'T00:00:00'),
    ) ?? null

    const pcResult = pcAfterBred?.preg_check_result ?? null
    const estCalving =
      latestBred.expected_calving_date ?? addDaysTo(latestBred.event_date, 283)

    if (pcResult === 'confirmed') {
      return {
        status: 'confirmed', breedable: false,
        blockReason: `Bred to ${sireName ?? 'unknown bull'} on ${fmtDate(latestBred.event_date)}`,
        lastBred: lastBredResult,
        lastPregCheckResult: 'confirmed',
        lastPregCheckDate: pcAfterBred?.event_date ?? null,
        lastCalvedDate, expectedCalvingDate: estCalving, daysSinceBred, daysSinceCalved,
      }
    }

    if (pcResult === 'recheck') {
      return {
        status: 'recheck', breedable: false,
        blockReason: `Recheck pending — bred ${fmtDate(latestBred.event_date)}`,
        lastBred: lastBredResult,
        lastPregCheckResult: 'recheck',
        lastPregCheckDate: pcAfterBred?.event_date ?? null,
        lastCalvedDate, expectedCalvingDate: estCalving, daysSinceBred, daysSinceCalved,
      }
    }

    if (pcResult === 'open') {
      openFallthrough = true  // skip postpartum check; fall to heifer gate / open
    } else {
      // No preg check after bred → actively bred, pending check
      return {
        status: 'bred', breedable: false,
        blockReason: `Bred to ${sireName ?? 'unknown bull'} on ${fmtDate(latestBred.event_date)}`,
        lastBred: lastBredResult,
        lastPregCheckResult: null, lastPregCheckDate: null,
        lastCalvedDate, expectedCalvingDate: estCalving, daysSinceBred, daysSinceCalved,
      }
    }
  }

  // Postpartum window (skip when cow already has open preg-check fallthrough)
  if (!openFallthrough && latestCalved) {
    if (daysSinceCalved !== null && daysSinceCalved < 45) {
      const eligibleDate = addDaysTo(latestCalved.event_date, 45)
      return {
        status: 'fresh_postpartum', breedable: false,
        blockReason: `Calved ${fmtDate(latestCalved.event_date)} — eligible ${fmtDate(eligibleDate)}`,
        lastBred: lastBredResult,
        lastPregCheckResult: null, lastPregCheckDate: null,
        lastCalvedDate, expectedCalvingDate: null, daysSinceBred, daysSinceCalved,
      }
    }
  }

  // Heifer eligibility gate
  if (sex === 'heifer') {
    if (animal.dob) {
      const ageInDays = daysDiff(new Date(animal.dob + 'T00:00:00'), today)
      if (ageInDays < 365) {
        return {
          status: 'too_young', breedable: false,
          blockReason: 'Heifer under 12 months',
          lastBred: lastBredResult,
          lastPregCheckResult: null, lastPregCheckDate: null,
          lastCalvedDate, expectedCalvingDate: null, daysSinceBred, daysSinceCalved,
        }
      }
    }
    if (animal.breeding_eligible === false) {
      return {
        status: 'held_back', breedable: false,
        blockReason: 'Not yet cleared for breeding',
        lastBred: lastBredResult,
        lastPregCheckResult: null, lastPregCheckDate: null,
        lastCalvedDate, expectedCalvingDate: null, daysSinceBred, daysSinceCalved,
      }
    }
  }

  // Open / eligible
  return {
    status: 'open', breedable: true, blockReason: null,
    lastBred: lastBredResult,
    lastPregCheckResult: openFallthrough ? 'open' : null,
    lastPregCheckDate:   openFallthrough ? (pcAfterBred?.event_date ?? null) : null,
    lastCalvedDate, expectedCalvingDate: null, daysSinceBred, daysSinceCalved,
  }
}
