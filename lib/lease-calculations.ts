// Shared billing calculations for leases. Used in API routes and client components.

export type RateType = 'per_head_day' | 'per_head' | 'per_head_month' | 'per_acre' | 'per_aum' | 'flat'

export const AUM_FACTORS: Record<string, number> = {
  bull: 1.5, cow: 1.0, heifer: 0.75, steer: 0.75, calf: 0.5,
}

export function getAumFactor(sex: string | null | undefined): number {
  if (!sex) return 1.0
  return AUM_FACTORS[sex.toLowerCase()] ?? 1.0
}

/** Calendar days that an assignment overlaps with a period (both ends inclusive). */
export function calcOverlapDays(
  assignStart: string,
  assignEnd: string | null,   // null = still active
  periodStart: string,
  periodEnd: string,
): number {
  const as = new Date(assignStart + 'T00:00:00')
  const ae = assignEnd ? new Date(assignEnd + 'T00:00:00') : new Date(periodEnd + 'T00:00:00')
  const ps = new Date(periodStart + 'T00:00:00')
  const pe = new Date(periodEnd + 'T00:00:00')
  const start = as > ps ? as : ps
  const end   = ae < pe ? ae : pe
  const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return days > 0 ? days : 0
}

/**
 * Cost contribution for a single animal over its overlap days.
 * Returns 0 for per_acre / flat — those are period-level (not per-animal).
 */
export function calcAnimalCost(
  overlapDays: number,
  sex: string | null | undefined,
  rateType: string | null,
  rate: number,
): number {
  if (rateType === 'per_head_day')                              return overlapDays * rate
  if (rateType === 'per_head' || rateType === 'per_head_month') return overlapDays * (rate / 30)
  if (rateType === 'per_aum')                                   return overlapDays * getAumFactor(sex) * (rate / 30)
  return 0
}

/** Period-level cost for rate types that don't vary by individual animal. */
export function calcPeriodLevelCost(
  periodDays: number,
  rateType: string | null,
  rate: number,
  acreage?: number | null,
): number {
  if (rateType === 'per_acre') return ((rate * (acreage ?? 0)) / 12) * (periodDays / 30)
  if (rateType === 'flat')     return rate * (periodDays / 30)
  return 0
}

export function getRateLabel(
  rateType: string | null,
  lease: {
    rate_per_head?: number | null
    rate_per_acre?: number | null
    rate_per_aum?: number | null
    flat_rate?: number | null
    acreage?: number | null
  },
): string {
  if (rateType === 'per_head_day')    return `$${Number(lease.rate_per_head || 0).toFixed(2)}/head/day`
  if (rateType === 'per_head' || rateType === 'per_head_month')
                                      return `$${Number(lease.rate_per_head || 0).toFixed(2)}/head/month`
  if (rateType === 'per_acre')        return `$${Number(lease.rate_per_acre || 0).toFixed(2)}/acre/year · ${lease.acreage ?? 0} acres`
  if (rateType === 'flat')            return `Flat rate: $${Number(lease.flat_rate || 0).toFixed(2)}/month`
  if (rateType === 'per_aum')         return `$${Number(lease.rate_per_aum || 0).toFixed(2)}/AUM/month`
  return 'No rate set'
}
