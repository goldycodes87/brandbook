import { Constants } from '@/lib/database.types'
import type { Database } from '@/lib/database.types'

/**
 * Narrowing a value from outside the app onto a database enum.
 *
 * A query string, a form field or a tool argument arrives as `string`. Passing
 * it straight into `.eq('status', …)` used to compile because every query was
 * untyped, and `?status=activee` came back as an empty herd rather than an
 * error — silently, which is the worst way for a filter to be wrong.
 *
 * These return null for anything that is not a real value, so a caller has to
 * decide what to do about it instead of the database quietly answering nothing.
 */

type Enums = Database['public']['Enums']

function narrow<K extends keyof Enums>(kind: K, value: unknown): Enums[K] | null {
  if (typeof value !== 'string') return null
  const allowed = Constants.public.Enums[kind] as readonly string[]
  return allowed.includes(value) ? (value as Enums[K]) : null
}

export const asAnimalStatus    = (v: unknown) => narrow('animal_status', v)
export const asAnimalSex       = (v: unknown) => narrow('animal_sex', v)
export const asHealthEventType = (v: unknown) => narrow('health_event_type', v)
export const asReproEventType  = (v: unknown) => narrow('repro_event_type', v)
export const asInvoiceStatus   = (v: unknown) => narrow('invoice_status', v)

/** Several values at once — for `.in('sex', […])`. Unknown values are dropped. */
export function asAnimalSexList(values: unknown): Enums['animal_sex'][] {
  const list = Array.isArray(values) ? values : typeof values === 'string' ? values.split(',') : []
  return list.map(asAnimalSex).filter((v): v is Enums['animal_sex'] => v !== null)
}
