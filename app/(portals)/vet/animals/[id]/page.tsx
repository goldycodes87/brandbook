import { redirect, notFound } from 'next/navigation'
import { getVetSession } from '@/lib/vet-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { VetShell } from '@/components/vet/VetShell'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function VetAnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const vet = await getVetSession()
  if (!vet) redirect('/vet/login')

  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: animal }, { data: healthEvents }, { data: weights }] = await Promise.all([
    supabase.from('animals').select('*').eq('id', id).maybeSingle(),
    supabase.from('health_events').select('*').eq('animal_id', id).order('event_date', { ascending: false }).limit(20),
    supabase.from('weights').select('*').eq('animal_id', id).order('weighed_at', { ascending: false }).limit(10),
  ])

  if (!animal) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const activeWithdrawals = (healthEvents ?? []).filter(e => e.withdrawal_clear_date && e.withdrawal_clear_date >= today)

  return (
    <VetShell vetName={vet.name}>
      <PageContainer>
        <PageHeader
          title={`#${animal.tag_number}${animal.name ? ` — ${animal.name}` : ''}`}
          subtitle={<><a href="/vet/animals" style={{ color: 'var(--accent)' }}>← Animals</a></>}
        />

        {activeWithdrawals.length > 0 && (
          <div
            className="mb-4 rounded-[var(--radius-lg)] px-4 py-3 type-helper"
            style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-fg)' }}
          >
            ⚠ Withdrawal active — {activeWithdrawals[0].drug_name} clear {fmtDate(activeWithdrawals[0].withdrawal_clear_date)}
          </div>
        )}

        <Panel title="ANIMAL INFO">
          {[
            ['Tag number', animal.tag_number],
            ['Name',       animal.name ?? '—'],
            ['Sex',        animal.sex ?? '—'],
            ['Breed',      animal.breed ?? '—'],
            ['DOB',        fmtDate(animal.dob)],
            ['Status',     animal.status ?? '—'],
            ['Notes',      animal.notes ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="type-field-label">{label}</span>
              <span className="type-data-sm text-right" style={{ color: 'var(--text-secondary)' }}>{value}</span>
            </div>
          ))}
        </Panel>

        <Panel title="HEALTH HISTORY" className="mt-4">
          {(healthEvents ?? []).length === 0 ? (
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>No health events recorded.</p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {(healthEvents ?? []).map(ev => (
                <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="type-data-sm font-semibold capitalize">{ev.event_type?.replace('_', ' ')}</p>
                    {ev.drug_name && <p className="type-helper" style={{ color: 'var(--text-secondary)' }}>{ev.drug_name}{ev.dose_amount ? ` — ${ev.dose_amount}${ev.dose_unit ? ' ' + ev.dose_unit : ''}` : ''}</p>}
                    {ev.notes && <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{ev.notes}</p>}
                  </div>
                  <span className="type-helper whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.event_date)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {(weights ?? []).length > 0 && (
          <Panel title="WEIGHT HISTORY" className="mt-4">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
              {(weights ?? []).map(w => (
                <div key={w.id} className="py-2 flex items-center justify-between">
                  <span className="type-data-sm font-semibold">{w.weight_lbs} lbs</span>
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(w.weighed_at?.slice(0, 10))}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </PageContainer>
    </VetShell>
  )
}
