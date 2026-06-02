import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
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
  searchParams: Promise<{ search?: string; status?: string; sex?: string; page?: string; sort?: string; dir?: string }>
}

async function AnimalList({ searchParams }: { searchParams: Awaited<PageProps['searchParams']> }) {
  const supabase = createAdminClient()
  const page   = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const limit  = 50
  const offset = (page - 1) * limit

  const sortMap: Record<string, string> = {
    tag_number: 'tag_number', name: 'name', sex: 'sex',
    breed: 'breed', status: 'status', created_at: 'created_at',
  }
  const sortCol = sortMap[searchParams.sort ?? ''] ?? 'tag_number'
  const ascending = searchParams.dir !== 'desc'

  const [{ data: ranchData }, queryResult] = await Promise.all([
    supabase.from('ranch_settings').select('ranch_name').maybeSingle(),
    (() => {
      let q = supabase
        .from('animals')
        .select(
          `id, tag_number, name, dob, sex, calf_sex, status, breed, breed_percentage, breeds, owner_id, photos,
           owner:owner_id ( id, name ),
           weights ( weight_lbs, weighed_at )`,
          { count: 'exact' }
        )
        .order(sortCol, { ascending, nullsFirst: false })
        .order('weighed_at', { referencedTable: 'weights', ascending: false })
        .range(offset, offset + limit - 1)
      if (searchParams.search) q = q.or(`tag_number.ilike.%${searchParams.search}%,name.ilike.%${searchParams.search}%`)
      if (searchParams.status) q = q.eq('status', searchParams.status)
      if (searchParams.sex)    q = q.eq('sex', searchParams.sex)
      return q
    })(),
  ])

  const { data, error, count } = queryResult
  const ranchName = (ranchData as { ranch_name?: string } | null)?.ranch_name ?? 'My Ranch'

  if (error) {
    return <p className="type-body" style={{ color: 'var(--danger-fg)' }}>{error.message}</p>
  }

  const animals: AnimalListItem[] = (data ?? []).map(a => {
    const sorted = [...(a.weights ?? [])].sort(
      (x, y) => new Date(y.weighed_at).getTime() - new Date(x.weighed_at).getTime()
    )
    const { weights: _, ...rest } = a as typeof a & { weights: unknown }
    const ownerDisplayName = (rest as { owner?: { name?: string } | null }).owner?.name ?? ranchName
    return { ...rest, latest_weight: sorted[0] ?? null, owner_display_name: ownerDisplayName } as unknown as AnimalListItem
  })

  if (!animals.length) {
    return (
      <EmptyState
        variant="action"
        title="No animals found"
        body={searchParams.search || searchParams.status || searchParams.sex ? 'Try clearing your filters.' : 'Add your first animal to get started.'}
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
          <ButtonLink href="/animals/new" intent="primary" size="sm">+ ADD ANIMAL</ButtonLink>
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
