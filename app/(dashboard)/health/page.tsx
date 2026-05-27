import { Suspense } from 'react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toolbar } from '@/components/ui/Toolbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { StatusChip } from '@/components/ui/Chip'
import { HEALTH_EVENT_CHIP, WITHDRAWAL_CHIP } from '@/components/ui/tokens'
import { WithdrawalWidget } from '@/components/health/WithdrawalWidget'
import { HealthFilters } from '@/components/health/HealthFilters'

interface PageProps {
  searchParams: Promise<{ search?: string; event_type?: string; in_withdrawal?: string; page?: string }>
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function HealthList({ sp }: { sp: Awaited<PageProps['searchParams']> }) {
  const supabase = createAdminClient()
  const today    = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from('health_events')
    .select('id, event_type, event_date, drug_name, dose_amount, dose_unit, withdrawal_days, withdrawal_clear_date, bcs_score, administered_by, notes, animal:animal_id ( id, tag_number, name )', { count: 'exact' })
    .order('event_date', { ascending: false })
    .limit(100)

  if (sp.event_type)    query = query.eq('event_type', sp.event_type)
  if (sp.in_withdrawal === 'true') {
    query = query.not('withdrawal_clear_date', 'is', null).gte('withdrawal_clear_date', today)
  }

  const { data, error, count } = await query
  if (error) return <p className="type-body" style={{ color: 'var(--danger-fg)' }}>{error.message}</p>

  const events = data ?? []

  if (!events.length) {
    return <EmptyState variant="action" title="No health events found" body="Log a health event to get started." />
  }

  return (
    <>
      <p className="type-data-sm mb-3" style={{ color: 'var(--text-muted)' }}>{count ?? events.length} events</p>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {events.map(ev => {
          const wd = ev.withdrawal_clear_date
          const inWd = wd && new Date(wd) > new Date()
          const animal = ev.animal as unknown as { id: string; tag_number: string; name: string | null } | null
          return (
            <div key={ev.id} className="rounded-[var(--radius-lg)] p-4" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex gap-2 flex-wrap">
                  <StatusChip map={HEALTH_EVENT_CHIP} value={ev.event_type} size="sm" />
                  {wd && <StatusChip map={WITHDRAWAL_CHIP} value={inWd ? 'active' : 'clear'} size="sm" />}
                </div>
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.event_date)}</span>
              </div>
              {animal && (
                <Link href={`/animals/${animal.id}`} className="type-data-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                  #{animal.tag_number}{animal.name ? ` — ${animal.name}` : ''}
                </Link>
              )}
              {ev.drug_name && <p className="type-helper mt-1" style={{ color: 'var(--text-secondary)' }}>{ev.drug_name}</p>}
            </div>
          )
        })}
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Animal</TH>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Drug / Notes</TH>
              <TH>Withdrawal</TH>
              <TH>By</TH>
            </TR>
          </THead>
          <TBody>
            {events.map(ev => {
              const wd = ev.withdrawal_clear_date
              const inWd = wd && new Date(wd) > new Date()
              const animal = ev.animal as unknown as { id: string; tag_number: string; name: string | null } | null
              return (
                <TR key={ev.id}>
                  <TD>
                    {animal ? (
                      <Link href={`/animals/${animal.id}`} className="type-data-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                        #{animal.tag_number}
                      </Link>
                    ) : '—'}
                  </TD>
                  <TD>{fmtDate(ev.event_date)}</TD>
                  <TD><StatusChip map={HEALTH_EVENT_CHIP} value={ev.event_type} size="sm" /></TD>
                  <TD>
                    {ev.drug_name ?? '—'}
                    {ev.dose_amount ? ` ${ev.dose_amount}${ev.dose_unit ? ' ' + ev.dose_unit : ''}` : ''}
                  </TD>
                  <TD>
                    {wd ? <StatusChip map={WITHDRAWAL_CHIP} value={inWd ? 'active' : 'clear'} size="sm" /> : '—'}
                  </TD>
                  <TD>{ev.administered_by ?? '—'}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </div>
    </>
  )
}

export default async function HealthPage({ searchParams }: PageProps) {
  const sp = await searchParams

  return (
    <PageContainer>
      <PageHeader
        title="Health"
        subtitle="Treatments, vaccinations &amp; withdrawal tracking"
        actions={
          <Link href="/animals">
            <Button intent="primary" size="sm">+ LOG EVENT</Button>
          </Link>
        }
      />

      <div className="mb-5">
        <Suspense fallback={null}>
          <WithdrawalWidget />
        </Suspense>
      </div>

      <Toolbar className="mb-4" leading={<HealthFilters />} />

      <Suspense
        key={JSON.stringify(sp)}
        fallback={
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
            ))}
          </div>
        }
      >
        <HealthList sp={sp} />
      </Suspense>
    </PageContainer>
  )
}
