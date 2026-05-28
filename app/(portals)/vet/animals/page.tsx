import { redirect } from 'next/navigation'
import { getVetSession } from '@/lib/vet-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { VetShell } from '@/components/vet/VetShell'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function VetAnimalsPage() {
  const vet = await getVetSession()
  if (!vet) redirect('/vet/login')

  const supabase = createAdminClient()
  const { data, count } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, breed, dob, status', { count: 'exact' })
    .eq('status', 'active')
    .order('tag_number')
    .limit(200)

  const animals = data ?? []

  return (
    <VetShell vetName={vet.name}>
      <PageContainer>
        <PageHeader title="Animals" subtitle={`${count ?? animals.length} active animals in herd`} />

        {animals.length === 0 ? (
          <EmptyState variant="neutral" title="No animals found" body="No animals are in the herd yet." />
        ) : (
          <>
            {/* Mobile */}
            <div className="flex flex-col gap-2 md:hidden">
              {animals.map(a => (
                <Link key={a.id} href={`/vet/animals/${a.id}`}>
                  <div className="rounded-[var(--radius-lg)] p-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
                    <p className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{a.tag_number}</p>
                    {a.name && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{a.name}</p>}
                    <p className="type-helper mt-1 capitalize" style={{ color: 'var(--text-secondary)' }}>
                      {a.sex ?? '—'} · {a.breed ?? '—'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Tag #</TH>
                    <TH>Name</TH>
                    <TH>Sex</TH>
                    <TH>Breed</TH>
                    <TH>DOB</TH>
                  </TR>
                </THead>
                <TBody>
                  {animals.map(a => (
                    <TR key={a.id} interactive>
                      <TD>
                        <Link href={`/vet/animals/${a.id}`} className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                          #{a.tag_number}
                        </Link>
                      </TD>
                      <TD>{a.name ?? '—'}</TD>
                      <TD className="capitalize">{a.sex ?? '—'}</TD>
                      <TD>{a.breed ?? '—'}</TD>
                      <TD>{fmtDate(a.dob)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        )}
      </PageContainer>
    </VetShell>
  )
}
