import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toolbar } from '@/components/ui/Toolbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { StatusChip } from '@/components/ui/Chip'
import { ANIMAL_STATUS_CHIP, SEX_CHIP } from '@/components/ui/tokens'
import { AnimalCard } from '@/components/animals/AnimalCard'
import { AnimalFilters } from '@/components/animals/AnimalFilters'
import type { AnimalListItem } from '@/components/animals/AnimalCard'

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; sex?: string; page?: string }>
}

async function AnimalList({ searchParams }: { searchParams: Awaited<PageProps['searchParams']> }) {
  const supabase = await createClient()
  const page   = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const limit  = 50
  const offset = (page - 1) * limit

  let query = supabase
    .from('animals')
    .select(
      `id, tag_number, name, dob, sex, status, breed, breed_percentage, photos,
       owner:owner_id ( id, name ),
       weights ( weight_lbs, weighed_at )`,
      { count: 'exact' }
    )
    .order('tag_number', { ascending: true })
    .order('weighed_at', { referencedTable: 'weights', ascending: false })
    .range(offset, offset + limit - 1)

  if (searchParams.search) query = query.or(`tag_number.ilike.%${searchParams.search}%,name.ilike.%${searchParams.search}%`)
  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.sex)    query = query.eq('sex', searchParams.sex)

  const { data, error, count } = await query

  if (error) {
    return <p className="type-body" style={{ color: 'var(--danger-fg)' }}>{error.message}</p>
  }

  const animals: AnimalListItem[] = (data ?? []).map(a => {
    const sorted = [...(a.weights ?? [])].sort(
      (x, y) => new Date(y.weighed_at).getTime() - new Date(x.weighed_at).getTime()
    )
    const { weights: _, ...rest } = a as typeof a & { weights: unknown }
    return { ...rest, latest_weight: sorted[0] ?? null } as unknown as AnimalListItem
  })

  if (!animals.length) {
    return (
      <EmptyState
        variant="action"
        title="No animals found"
        body={searchParams.search || searchParams.status || searchParams.sex ? 'Try clearing your filters.' : 'Add your first animal to get started.'}
        action={
          !searchParams.search && !searchParams.status && !searchParams.sex
            ? <Link href="/animals/new"><Button intent="primary">+ ADD ANIMAL</Button></Link>
            : undefined
        }
      />
    )
  }

  return (
    <>
      <p className="type-data-sm mb-3" style={{ color: 'var(--text-muted)' }}>{count ?? animals.length} animals</p>

      {/* Mobile: card grid */}
      <div className="flex flex-col gap-2 md:hidden">
        {animals.map(a => <AnimalCard key={a.id} animal={a} />)}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Tag</TH>
              <TH>Name</TH>
              <TH>Sex</TH>
              <TH>Breed</TH>
              <TH>Status</TH>
              <TH>Last Weight</TH>
              <TH>Owner</TH>
            </TR>
          </THead>
          <TBody>
            {animals.map(a => (
              <TR key={a.id}>
                <TD>
                  <Link
                    href={`/animals/${a.id}`}
                    className="type-data-sm font-semibold hover:underline"
                    style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}
                  >
                    {a.tag_number}
                  </Link>
                </TD>
                <TD>{a.name ?? '—'}</TD>
                <TD>{a.sex ? <StatusChip map={SEX_CHIP} value={a.sex} size="sm" /> : '—'}</TD>
                <TD>
                  {a.breed
                    ? a.breed_percentage && a.breed_percentage < 100
                      ? `${a.breed_percentage}% ${a.breed}`
                      : a.breed
                    : '—'}
                </TD>
                <TD><StatusChip map={ANIMAL_STATUS_CHIP} value={a.status} size="sm" /></TD>
                <TD>{a.latest_weight ? `${a.latest_weight.weight_lbs} lb` : '—'}</TD>
                <TD>{a.owner?.name ?? '—'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  )
}

async function AnimalStats() {
  const supabase = await createClient()
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
          <Link href="/animals/new">
            <Button intent="primary" size="sm">+ ADD ANIMAL</Button>
          </Link>
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
