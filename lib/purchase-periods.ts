/**
 * The date ranges a person actually asks for.
 *
 * Kept out of both the API and the page so the label on the button and the
 * dates behind it come from one place — a selector saying "Last quarter" over
 * a report covering something else is the kind of mismatch nobody notices
 * until it is in front of an accountant.
 *
 * Quarters here are calendar quarters, matching how the ranch bills.
 */

export type PeriodKey =
  | 'this_year' | 'last_year'
  | 'this_quarter' | 'last_quarter'
  | 'all_time'

export interface Period {
  key: PeriodKey
  label: string
  /** Inclusive YYYY-MM-DD, or null for no bound. */
  start: string | null
  end: string | null
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export function resolvePeriod(key: PeriodKey, today = new Date()): Period {
  const y = today.getUTCFullYear()
  const q = Math.floor(today.getUTCMonth() / 3)

  const quarter = (year: number, qi: number): [string, string] => [
    iso(new Date(Date.UTC(year, qi * 3, 1))),
    iso(new Date(Date.UTC(year, qi * 3 + 3, 0))),
  ]

  switch (key) {
    case 'this_year':
      return { key, label: `${y}`, start: `${y}-01-01`, end: `${y}-12-31` }
    case 'last_year':
      return { key, label: `${y - 1}`, start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case 'this_quarter': {
      const [s, e] = quarter(y, q)
      return { key, label: `Q${q + 1} ${y}`, start: s, end: e }
    }
    case 'last_quarter': {
      const py = q === 0 ? y - 1 : y
      const pq = q === 0 ? 3 : q - 1
      const [s, e] = quarter(py, pq)
      return { key, label: `Q${pq + 1} ${py}`, start: s, end: e }
    }
    case 'all_time':
    default:
      return { key: 'all_time', label: 'All time', start: null, end: null }
  }
}

export const PERIOD_CHOICES: Array<{ key: PeriodKey; label: string }> = [
  { key: 'this_year',    label: 'This year' },
  { key: 'last_year',    label: 'Last year' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'last_quarter', label: 'Last quarter' },
  { key: 'all_time',     label: 'All time' },
]

/** Undated purchases sit outside every bounded period, and that is deliberate. */
export function withinPeriod(date: string | null, p: Period): boolean {
  if (p.start === null && p.end === null) return true
  if (!date) return false
  if (p.start && date < p.start) return false
  if (p.end   && date > p.end)   return false
  return true
}
