/**
 * Import cattle/bovine drug labels from DailyMed (NLM/FDA Structured Product Labeling).
 *
 * Source: https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json
 * Search terms: bovine, cattle, beef, dairy (covers ~320 unique SPL records)
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/import-fda-drugs.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const DAILYMED_BASE = 'https://dailymed.nlm.nih.gov/dailymed/services/v2'
const PAGE_SIZE = 100
const DELAY_MS = 200 // be polite to NLM servers

const SEARCH_TERMS = ['bovine', 'cattle', 'beef', 'dairy']

// Title format: "BRAND NAME (GENERIC NAME) [MANUFACTURER]"
// Generic may contain nested parens e.g. "THROMBIN, TOPICAL (BOVINE ORIGIN)"
function parseTitle(title: string): {
  brand_name: string
  generic_name: string | null
  manufacturer: string | null
} {
  // Strip manufacturer from end: [...]
  const mfrMatch  = title.match(/\s*\[([^\]]+)\]\s*$/)
  const manufacturer = mfrMatch ? mfrMatch[1].trim() : null
  const withoutMfr = mfrMatch ? title.slice(0, mfrMatch.index).trim() : title.trim()

  // Find the FIRST "(" — brand name is everything before it
  const firstParen = withoutMfr.indexOf('(')
  if (firstParen === -1) {
    return { brand_name: withoutMfr.trim(), generic_name: null, manufacturer }
  }

  const brand_name = withoutMfr.slice(0, firstParen).trim() || withoutMfr.trim()

  // Extract generic by finding the matching closing paren (handles nesting)
  let depth = 0
  let start = -1
  let end   = -1
  for (let i = firstParen; i < withoutMfr.length; i++) {
    if (withoutMfr[i] === '(') { if (depth === 0) start = i + 1; depth++ }
    else if (withoutMfr[i] === ')') { depth--; if (depth === 0) { end = i; break } }
  }
  const generic_name = (start !== -1 && end !== -1)
    ? withoutMfr.slice(start, end).trim()
    : null

  return { brand_name, generic_name, manufacturer }
}

function inferRoute(title: string): string | null {
  const t = title.toUpperCase()
  if (t.includes('POUR-ON'))                        return 'Topical pour-on'
  if (t.includes('INJECTABLE') || t.includes('INJECTION')) return 'Injectable'
  if (t.includes('INTRAMAMMARY'))                   return 'Intramammary'
  if (t.includes('INTRAUTERINE'))                   return 'Intrauterine'
  if (t.includes('IMPLANT'))                        return 'Subcutaneous implant'
  if (t.includes('DRENCH') || t.includes('ORAL') || t.includes('BOLUS')) return 'Oral'
  if (t.includes('TOPICAL'))                        return 'Topical'
  if (t.includes('OPHTHALMIC'))                     return 'Ophthalmic'
  return null
}

function inferSpecies(title: string, searchTerm: string): string[] {
  const t = title.toUpperCase()
  const species = new Set<string>()
  if (t.includes('CATTLE') || t.includes('BOVINE') || searchTerm === 'bovine') species.add('cattle')
  if (t.includes('BEEF'))   species.add('beef cattle')
  if (t.includes('DAIRY'))  species.add('dairy cattle')
  if (t.includes('CALF') || t.includes('CALVES')) species.add('calves')
  if (t.includes('SWINE') || t.includes('PIG'))   species.add('swine')
  if (t.includes('SHEEP') || t.includes('OVINE')) species.add('sheep')
  if (t.includes('GOAT'))                          species.add('goat')
  if (t.includes('HORSE') || t.includes('EQUINE'))species.add('equine')
  if (species.size === 0) species.add(searchTerm)
  return [...species]
}

// Infer drug class from generic name keywords
function inferDrugClass(generic: string | null): string | null {
  if (!generic) return null
  const g = generic.toLowerCase()
  if (/ivermectin|eprinomectin|doramectin|moxidectin|abamectin/.test(g)) return 'Antiparasitic - Macrocyclic lactone'
  if (/albendazole|fenbendazole|oxfendazole|thiabendazole/.test(g))        return 'Antiparasitic - Benzimidazole'
  if (/penicillin|ampicillin|amoxicillin|cloxacillin/.test(g))             return 'Antibiotic - Penicillin'
  if (/tetracycline|oxytetracycline|chlortetracycline/.test(g))            return 'Antibiotic - Tetracycline'
  if (/ceftiofur|cephalosporin/.test(g))                                   return 'Antibiotic - Cephalosporin'
  if (/tulathromycin|gamithromycin|tilmicosin|tylosin/.test(g))            return 'Antibiotic - Macrolide'
  if (/enrofloxacin|danofloxacin|marbofloxacin/.test(g))                   return 'Antibiotic - Fluoroquinolone'
  if (/sulfa|sulfamethazine|sulfadimethoxine/.test(g))                     return 'Antibiotic - Sulfonamide'
  if (/flunixin|meloxicam|ketoprofen|phenylbutazone/.test(g))               return 'NSAID'
  if (/dexamethasone|prednisolone|cortisone/.test(g))                      return 'Corticosteroid'
  if (/oxytocin|progesterone|estradiol|gnrh|prostaglandin|cloprostenol/.test(g)) return 'Reproductive hormone'
  if (/vaccine|bacterin|toxoid/.test(g))                                   return 'Vaccine / Biologics'
  if (/vitamin|mineral|selenium|zinc/.test(g))                             return 'Nutritional supplement'
  if (/lidocaine|xylazine|ketamine|butorphanol/.test(g))                   return 'Anesthetic / Sedative'
  if (/thrombin/.test(g))                                                  return 'Hemostatic'
  return null
}

// Extract withdrawal note from SPL XML
async function fetchWithdrawalNote(setid: string): Promise<string | null> {
  try {
    const url = `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${setid}&action=getfile&type=xml`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const xml = await res.text()
    // Find slaughter/milk withdrawal sentences
    const re = /[^.]*(?:slaughter|milk|withdrawal)[^.]{0,200}\./gi
    const hits: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const clean = m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (clean.length > 15 && clean.length < 300) hits.push(clean)
    }
    if (!hits.length) return null
    return [...new Set(hits)].slice(0, 3).join(' | ').slice(0, 500)
  } catch {
    return null
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchAllForTerm(term: string): Promise<Map<string, { setid: string; title: string; term: string }>> {
  const results = new Map<string, { setid: string; title: string; term: string }>()
  let page = 1
  while (true) {
    const url = `${DAILYMED_BASE}/spls.json?title=${encodeURIComponent(term)}&pagesize=${PAGE_SIZE}&page=${page}`
    const res = await fetch(url)
    if (!res.ok) break
    const data = await res.json() as {
      data: { setid: string; title: string }[]
      metadata: { total_pages: number; current_page: number }
    }
    for (const item of data.data) {
      if (!results.has(item.setid)) {
        results.set(item.setid, { setid: item.setid, title: item.title, term })
      }
    }
    if (data.metadata.current_page >= data.metadata.total_pages) break
    page++
    await sleep(DELAY_MS)
  }
  return results
}

async function fetchNDCs(setid: string): Promise<string | null> {
  try {
    const url = `${DAILYMED_BASE}/spls/${setid}/ndcs.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json() as { data: { ndcs: { ndc: string }[] } }
    return data.data?.ndcs?.[0]?.ndc ?? null
  } catch {
    return null
  }
}

async function main() {
  console.log('=== FDA Animal Drug Import (via DailyMed SPL API) ===\n')

  // ── Step 1: collect all unique SPL records across search terms ──
  console.log('Fetching drug labels from DailyMed...')
  const allRecords = new Map<string, { setid: string; title: string; term: string }>()
  for (const term of SEARCH_TERMS) {
    const records = await fetchAllForTerm(term)
    let newCount = 0
    for (const [setid, rec] of records) {
      if (!allRecords.has(setid)) { allRecords.set(setid, rec); newCount++ }
    }
    console.log(`  "${term}": ${records.size} records (${newCount} new)`)
    await sleep(DELAY_MS)
  }
  console.log(`\nTotal unique SPL records: ${allRecords.size}`)

  // ── Step 2: enrich + insert ──
  let inserted = 0
  let skipped  = 0
  let errored  = 0
  let i = 0

  for (const { setid, title, term } of allRecords.values()) {
    i++
    if (i % 20 === 0) console.log(`  Processing ${i}/${allRecords.size}...`)

    const { brand_name, generic_name, manufacturer } = parseTitle(title)
    const route      = inferRoute(title)
    const species    = inferSpecies(title, term)
    const drug_class = inferDrugClass(generic_name)

    // Fetch NDC (primary key for dedup)
    const ndc_code = await fetchNDCs(setid)
    await sleep(DELAY_MS)

    // Fetch withdrawal note from SPL XML
    const withdrawal_note = await fetchWithdrawalNote(setid)
    await sleep(DELAY_MS)

    const row = {
      brand_name,
      generic_name,
      manufacturer,
      ndc_code:  ndc_code ?? setid,
      route,
      species,
      drug_class,
      notes:     withdrawal_note,
      source:    'master',
      is_active: true,
    }

    const { error } = await supabase
      .from('drug_library')
      .insert(row)
      .select('id')
      .single()

    if (!error) {
      inserted++
    } else if (error.code === '23505') {
      // unique violation — NDC already exists
      skipped++
    } else {
      errored++
      if (errored <= 3) {
        // Log first few errors so we know if schema is wrong
        console.error(`  ERROR on "${brand_name}": ${error.message}`)
        if (error.message.includes('permission')) {
          console.error('  → Run in Supabase SQL editor: GRANT SELECT, INSERT ON public.drug_library TO service_role;')
          process.exit(1)
        }
        if (error.code === 'PGRST204') {
          console.error('  → Column mismatch. Row attempted:', JSON.stringify(row, null, 2))
          process.exit(1)
        }
      }
    }
  }

  console.log('\n=== Import complete ===')
  console.log(`  Total fetched : ${allRecords.size}`)
  console.log(`  Inserted      : ${inserted}`)
  console.log(`  Skipped (dup) : ${skipped}`)
  console.log(`  Errored       : ${errored}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
