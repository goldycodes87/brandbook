export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SirePerformance {
  sire_id: string | null
  sire_library_id: string | null
  sire_name: string
  sire_breed: string | null
  sire_naab: string | null
  sire_type: 'library' | 'herd_bull'
  cows_bred: number
  calves_born: number
  heifer_calves: number
  bull_calves: number
  conception_rate: number | null
  avg_birth_weight: number | null
  avg_weaning_weight: number | null
  calves_by_year: Record<string, number>
  calves: Array<{ id: string; tag_number: string; calf_sex: string | null; dob: string | null; birth_weight_lbs: number | null; weaning_weight_lbs: number | null }>
}

interface CalfRow {
  id: string
  tag_number: string
  calf_sex: string | null
  sex: string | null
  dob: string | null
  birth_weight_lbs: number | null
  weaning_weight_lbs: number | null
}

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const year              = searchParams.get('year') ?? ''
  const breed             = searchParams.get('breed') ?? ''
  const filterLibraryId   = searchParams.get('sire_library_id') ?? ''
  const filterSireId      = searchParams.get('sire_id') ?? ''

  // Fetch calved events — use separate queries to avoid self-join issues
  const [{ data: calvedEvents }, { data: bredEvents }] = await Promise.all([
    supabase
      .from('reproduction_events')
      .select('id, sire_id, sire_library_id, event_date, calf_id')
      .eq('event_type', 'calved')
      .not('calf_id', 'is', null),
    supabase
      .from('reproduction_events')
      .select('sire_id, sire_library_id, event_date')
      .eq('event_type', 'bred'),
  ])

  if (!calvedEvents) return NextResponse.json({ data: [] })

  // Fetch calf details in a separate query
  const calfIds = calvedEvents.map(ev => ev.calf_id).filter(Boolean) as string[]
  let calfMap: Record<string, CalfRow> = {}
  if (calfIds.length) {
    const { data: calves } = await supabase
      .from('animals')
      .select('id, tag_number, calf_sex, sex, dob, birth_weight_lbs, weaning_weight_lbs')
      .in('id', calfIds)
    for (const c of (calves ?? [])) calfMap[c.id] = c as CalfRow
  }

  // Build sire key → bred count map
  const bredCounts: Record<string, number> = {}
  for (const ev of (bredEvents ?? [])) {
    const key = ev.sire_library_id ?? ev.sire_id ?? 'unknown'
    bredCounts[key] = (bredCounts[key] ?? 0) + 1
  }

  // Group calved events by sire
  const sireMap: Record<string, {
    sire_id: string | null
    sire_library_id: string | null
    calves: CalfRow[]
    years: string[]
  }> = {}

  for (const ev of calvedEvents) {
    const key = ev.sire_library_id ?? ev.sire_id ?? 'unknown'
    if (!sireMap[key]) {
      sireMap[key] = { sire_id: ev.sire_id, sire_library_id: ev.sire_library_id, calves: [], years: [] }
    }
    const calf = ev.calf_id ? calfMap[ev.calf_id] : null
    if (calf) sireMap[key].calves.push(calf)
    const yr = ev.event_date?.slice(0, 4)
    if (yr && !sireMap[key].years.includes(yr)) sireMap[key].years.push(yr)
  }

  // Fetch sire library entries for all unique sire_library_ids
  const libraryIds = [...new Set(Object.values(sireMap).map(s => s.sire_library_id).filter(Boolean))] as string[]
  let libraryMap: Record<string, { bull_name: string; breed: string | null; naab_code: string | null; bull_type: string }> = {}
  if (libraryIds.length) {
    const { data: libs } = await supabase
      .from('sire_library')
      .select('id, bull_name, breed, naab_code, bull_type')
      .in('id', libraryIds)
    for (const l of (libs ?? [])) libraryMap[l.id] = l
  }

  // Fetch herd bull names for sire_id entries
  const herdIds = [...new Set(Object.values(sireMap).map(s => s.sire_id).filter(Boolean))] as string[]
  let herdMap: Record<string, { tag_number: string; name: string | null; breed: string | null }> = {}
  if (herdIds.length) {
    const { data: bulls } = await supabase
      .from('animals')
      .select('id, tag_number, name, breed')
      .in('id', herdIds)
    for (const b of (bulls ?? [])) herdMap[b.id] = b
  }

  // Build performance objects
  const results: SirePerformance[] = []
  for (const [key, entry] of Object.entries(sireMap)) {
    const calves = entry.calves.filter(Boolean) as CalfRow[]

    // Apply year filter
    const filteredCalves = year
      ? calves.filter(c => c.dob?.startsWith(year))
      : calves

    const heiferCalves = filteredCalves.filter(c => c.calf_sex === 'heifer_calf').length
    const bullCalves   = filteredCalves.filter(c => c.calf_sex === 'bull_calf').length
    const bwList  = filteredCalves.map(c => c.birth_weight_lbs).filter((w): w is number => w != null)
    const wwList  = filteredCalves.map(c => c.weaning_weight_lbs).filter((w): w is number => w != null)
    const cowsBred = bredCounts[key] ?? 0

    const calvesByYear: Record<string, number> = {}
    for (const c of filteredCalves) {
      const yr = c.dob?.slice(0, 4) ?? 'unknown'
      calvesByYear[yr] = (calvesByYear[yr] ?? 0) + 1
    }

    let sire_name = 'Unknown Sire'
    let sire_breed: string | null = null
    let sire_naab: string | null  = null
    let sire_type: 'library' | 'herd_bull' = 'herd_bull'

    if (entry.sire_library_id && libraryMap[entry.sire_library_id]) {
      const lib = libraryMap[entry.sire_library_id]
      sire_name  = lib.bull_name
      sire_breed = lib.breed
      sire_naab  = lib.naab_code
      sire_type  = 'library'
    } else if (entry.sire_id && herdMap[entry.sire_id]) {
      const bull = herdMap[entry.sire_id]
      sire_name  = `#${bull.tag_number}${bull.name ? ` — ${bull.name}` : ''}`
      sire_breed = bull.breed
    }

    // Apply filters
    if (breed && sire_breed !== breed) continue
    if (filterLibraryId && entry.sire_library_id !== filterLibraryId) continue
    if (filterSireId && entry.sire_id !== filterSireId) continue

    results.push({
      sire_id:            entry.sire_id,
      sire_library_id:    entry.sire_library_id,
      sire_name,
      sire_breed,
      sire_naab,
      sire_type,
      cows_bred:          cowsBred,
      calves_born:        filteredCalves.length,
      heifer_calves:      heiferCalves,
      bull_calves:        bullCalves,
      conception_rate:    cowsBred > 0 ? Math.round((filteredCalves.length / cowsBred) * 100) : null,
      avg_birth_weight:   bwList.length ? Math.round(bwList.reduce((a, b) => a + b, 0) / bwList.length) : null,
      avg_weaning_weight: wwList.length ? Math.round(wwList.reduce((a, b) => a + b, 0) / wwList.length) : null,
      calves_by_year:     calvesByYear,
      calves:             filteredCalves.slice(0, 20).map(c => ({
        id:                c.id,
        tag_number:        c.tag_number,
        calf_sex:          c.calf_sex,
        dob:               c.dob,
        birth_weight_lbs:  c.birth_weight_lbs,
        weaning_weight_lbs: c.weaning_weight_lbs,
      })),
    })
  }

  results.sort((a, b) => b.calves_born - a.calves_born)

  return NextResponse.json({ data: results })
}
