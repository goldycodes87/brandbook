import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveReproStatus } from '@/lib/repro-status'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Toolbar } from '@/components/ui/Toolbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { AnimalFilters } from '@/components/animals/AnimalFilters'
import { AnimalSortableTable } from '@/components/animals/AnimalSortableTable'
import type { AnimalListItem } from '@/components/animals/AnimalCard'

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; sex?: string; cull?: string; page?: string; sort?: string; dir?: string }>
}

async function AnimalList({ searchParams }: { searchParams: Awaited<PageProps['searchParams']> }) {
  const supabase = createAdminClient()
  const page   = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const limit  = 50
  const offset = (page - 1) * limit

  const isJsSort = searchParams.sort === 'owner' || searchParams.sort === 'breed'
  const sortMap: Record<string, string> = {
    tag_number: 'tag_number', name: 'name', sex: 'sex',
    breed: 'breed', status: 'status', created_at: 'created_at',
  }
  const sortCol = isJsSort ? 'tag_number' : (sortMap[searchParams.sort ?? ''] ?? 'tag_number')
  const ascending = searchParams.dir !== 'desc'

  const [{ data: ranchData }, queryResult] = await Promise.all([
    supabase.from('ranch_settings').select('ranch_name').maybeSingle(),
    (() => {
      let q = supabase
        .from('animals')
        .select(
          `id, tag_number, name, dob, sex, calf_sex, status, breed, breed_percentage, breeds, owner_id, ear_tag_color, photos, breeding_eligible,
           cull_flagged_at, cull_reason,
           owner:owner_id ( id, name )`,
          { count: 'exact' }
        )
        .order(sortCol, { ascending, nullsFirst: false })
      if (!isJsSort) q = q.range(offset, offset + limit - 1)
      if (searchParams.search) q = q.or(`tag_number.ilike.%${searchParams.search}%,name.ilike.%${searchParams.search}%`)
      if (searchParams.status) q = q.eq('status', searchParams.status)
      if (searchParams.sex)    q = q.eq('sex', searchParams.sex)
      // The cull list is only ever animals still in the herd — once she is
      // sold she belongs to the sales record, not to a list of pending work.
      if (searchParams.cull === 'true') {
        q = q.not('cull_flagged_at', 'is', null).eq('status', 'active')
      }
      return q
    })(),
  ])

  const { data, error, count } = queryResult
  const ranchName = (ranchData as { ranch_name?: string } | null)?.ranch_name ?? 'My Ranch'

  if (error) {
    return <p className="type-body" style={{ color: 'var(--danger-fg)' }}>{error.message}</p>
  }

  // Fetch breeding status for cows/heifers on this page
  const animalIds = (data ?? [])
    .filter((a: { sex?: string | null }) => a.sex === 'cow' || a.sex === 'heifer')
    .map((a: { id: string }) => a.id)

  type ListReproEvent = {
    id: string; event_type: string; event_date: string; preg_check_result?: string | null
    sire_name_text?: string | null; sire_library_id?: string | null
    semen_inventory_id?: string | null; expected_calving_date?: string | null
    sire_library?: { bull_name?: string | null } | null
  }
  const eventsByAnimal: Record<string, ListReproEvent[]> = {}

  if (animalIds.length > 0) {
    const { data: reproData } = await supabase
      .from('reproduction_events')
      .select('id, animal_id, event_type, event_date, preg_check_result, sire_name_text, sire_library_id, semen_inventory_id, expected_calving_date, sire_library:sire_library_id(bull_name)')
      .in('animal_id', animalIds)
      .in('event_type', ['bred', 'preg_check', 'calved'])
      .order('event_date', { ascending: false })

    for (const ev of (reproData ?? [])) {
      const aid = ev.animal_id as string
      if (!eventsByAnimal[aid]) eventsByAnimal[aid] = []
      eventsByAnimal[aid].push(ev as ListReproEvent)
    }
  }

  let animals: AnimalListItem[] = (data ?? []).map(a => {
    const ownerDisplayName = (a as { owner?: { name?: string } | null }).owner?.name ?? ranchName
    const aid = (a as { id: string }).id
    const sex = (a as { sex?: string | null }).sex
    const isFemale = sex === 'cow' || sex === 'heifer'
    const repro = isFemale
      ? deriveReproStatus(
          a as {
            sex?: string | null; dob?: string | null; breeding_eligible?: boolean | null
            cull_flagged_at?: string | null; cull_reason?: string | null
          },
          eventsByAnimal[aid] ?? [],
        )
      : null
    return {
      ...a,
      latest_weight:   null,
      owner_display_name: ownerDisplayName,
      breeding_status: repro?.status ?? null,
      repro,
    } as unknown as AnimalListItem
  })

  if (isJsSort) {
    if (searchParams.sort === 'owner') {
      animals.sort((a, b) => {
        const an = (a.owner_display_name ?? '').toLowerCase()
        const bn = (b.owner_display_name ?? '').toLowerCase()
        return ascending ? an.localeCompare(bn) : bn.localeCompare(an)
      })
    } else if (searchParams.sort === 'breed') {
      animals.sort((a, b) => {
        const an = (a.breeds?.[0]?.breed ?? a.breed ?? '').toLowerCase()
        const bn = (b.breeds?.[0]?.breed ?? b.breed ?? '').toLowerCase()
        return ascending ? an.localeCompare(bn) : bn.localeCompare(an)
      })
    }
    animals = animals.slice(offset, offset + limit)
  }

  if (!animals.length) {
    return (
      <EmptyState
        variant="action"
        title="No animals found"
        body={searchParams.cull === 'true'
          ? 'Nothing on the cull list.'
          : searchParams.search || searchParams.status || searchParams.sex
            ? 'Try clearing your filters.'
            : 'Add your first animal to get started.'}
        action={
          !searchParams.search && !searchParams.status && !searchParams.sex
            ? <ButtonLink href="/animals/new" intent="primary">+ ADD ANIMAL</ButtonLink>
            : undefined
        }
      />
    )
  }

  const currentSort = sortMap[searchParams.sort ?? ''] ? (searchParams.sort ?? 'tag_number') : 'tag_number'
  const currentDir: 'asc' | 'desc' = searchParams.dir === 'desc' ? 'desc' : 'asc'

  return (
    <>
      <p className="type-data-sm mb-3" style={{ color: 'var(--text-muted)' }}>{count ?? animals.length} animals</p>
      <AnimalSortableTable animals={animals} currentSort={currentSort} currentDir={currentDir} />
    </>
  )
}

async function AnimalStats() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('animals').select('status', { count: 'exact', head: false })

  const total    = data?.length ?? 0
  const active   = data?.filter(a => a.status === 'active').length ?? 0
  const heifers  = data?.filter(a => a.status === 'heifer').length ?? 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard label="Total Animals" value={total} />
      <StatCard label="Active" value={active} />
      <StatCard label="Heifers" value={heifers} />
      <StatCard label="Other" value={total - active - heifers} />
    </div>
  )
}

export default async function AnimalsPage({ searchParams }: PageProps) {
  const sp = await searchParams

  return (
    <PageContainer>
      <PageHeader
        title="Animals"
        subtitle="Herd registry"
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/chute" intent="secondary" size="sm">CHUTE MODE</ButtonLink>
            <ButtonLink href="/animals/new" intent="primary" size="sm">+ ADD ANIMAL</ButtonLink>
          </div>
        }
      />

      <Suspense fallback={null}>
        <AnimalStats />
      </Suspense>

      <Toolbar className="mb-4" leading={<AnimalFilters />} />

      <Suspense
        key={JSON.stringify(sp)}
        fallback={
          <div className="flex flex-col gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
            ))}
          </div>
        }
      >
        <AnimalList searchParams={sp} />
      </Suspense>
    </PageContainer>
  )
}
