import { redirect } from 'next/navigation'
import { getVetSession } from '@/lib/vet-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { VetShell } from '@/components/vet/VetShell'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function VetDashboardPage() {
  const vet = await getVetSession()
  if (!vet) redirect('/vet/login')

  const supabase = createAdminClient()

  const [
    { count: openCases },
    { count: animalCount },
    { count: unreadMessages },
    { data: recentCases },
  ] = await Promise.all([
    supabase.from('vet_cases').select('id', { count: 'exact', head: true }).eq('vet_invite_id', vet.id).in('status', ['open', 'in_progress']),
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('vet_messages').select('id', { count: 'exact', head: true }).eq('vet_invite_id', vet.id).eq('direction', 'rancher_to_vet').is('read_at', null),
    supabase.from('vet_cases').select('id, title, status, updated_at, animal:animal_id ( tag_number, name )').eq('vet_invite_id', vet.id).order('updated_at', { ascending: false }).limit(5),
  ])

  return (
    <VetShell vetName={vet.name}>
      <PageContainer>
        <PageHeader
          title="Vet Dashboard"
          subtitle={`Welcome back, ${vet.name}`}
        />

        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Open Cases"     value={openCases ?? 0} />
          <StatCard label="Herd Animals"   value={animalCount ?? 0} />
          <StatCard label="Unread Messages" value={unreadMessages ?? 0} />
        </div>

        <Panel title="RECENT CASES">
          {recentCases?.length ? (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {recentCases.map(c => {
                const animal = c.animal as unknown as { tag_number: string; name: string | null } | null
                return (
                  <Link
                    key={c.id}
                    href={`/vet/cases/${c.id}`}
                    className="flex items-center justify-between gap-3 py-3 px-1 hover:opacity-80 transition-opacity"
                  >
                    <div>
                      <p className="type-data-sm font-semibold" style={{ color: 'var(--text)' }}>{c.title}</p>
                      {animal && (
                        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                          #{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
                        </p>
                      )}
                    </div>
                    <span
                      className="type-helper px-2 py-0.5 rounded-full capitalize"
                      style={{
                        backgroundColor: c.status === 'open' ? 'var(--warning-bg)' : c.status === 'resolved' ? 'var(--success-bg)' : 'var(--surface-2)',
                        color: c.status === 'open' ? 'var(--warning-fg)' : c.status === 'resolved' ? 'var(--success-fg)' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: c.status === 'open' ? 'var(--warning-border)' : c.status === 'resolved' ? 'var(--success-border)' : 'var(--border)',
                      }}
                    >
                      {c.status}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <EmptyState variant="neutral" title="No cases yet" body="Create a case when you need to document a consultation." panel={false} />
          )}
        </Panel>
      </PageContainer>
    </VetShell>
  )
}
