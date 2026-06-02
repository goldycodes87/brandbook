export interface BreedEntry { breed: string; pct: number }

export function calcCalfBreeds(
  damBreeds: BreedEntry[],
  sireBreeds: BreedEntry[]
): BreedEntry[] {
  if (!damBreeds.length && !sireBreeds.length) return []

  const combined: Record<string, number> = {}
  for (const b of damBreeds)  combined[b.breed] = (combined[b.breed] ?? 0) + b.pct * 0.5
  for (const b of sireBreeds) combined[b.breed] = (combined[b.breed] ?? 0) + b.pct * 0.5

  const entries = Object.entries(combined)
    .map(([breed, pct]) => ({ breed, pct: Math.round(pct) }))
    .filter(b => b.pct > 0)
    .sort((a, b) => b.pct - a.pct)

  // Fix rounding drift
  const total = entries.reduce((s, b) => s + b.pct, 0)
  if (entries.length > 0 && total !== 100) entries[0].pct += 100 - total

  return entries
}
