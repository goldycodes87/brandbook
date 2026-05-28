import { createAdminClient } from '@/lib/supabase/admin'
import { Panel } from '@/components/ui/Panel'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export async function BatchHistoryPanel() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('health_event_batches')
    .select('*')
    .order('batch_date', { ascending: false })
    .limit(20)

  const batches = data ?? []

  if (!batches.length) return null

  return (
    <Panel title="TREATMENT BATCHES">
      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {batches.map(b => (
          <div key={b.id} className="rounded-[var(--radius-md)] p-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="type-data-sm font-semibold">{b.drug_name ?? '—'}</span>
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(b.batch_date)}</span>
            </div>
            <p className="type-helper mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {b.group_label} · {b.animal_count ?? '?'} animals
            </p>
            {b.withdrawal_days && (
              <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Clear: {addDays(b.batch_date, b.withdrawal_days)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Group</TH>
              <TH>Drug</TH>
              <TH>Animals</TH>
              <TH>Withdrawal clear</TH>
              <TH>By</TH>
            </TR>
          </THead>
          <TBody>
            {batches.map(b => (
              <TR key={b.id}>
                <TD>{fmtDate(b.batch_date)}</TD>
                <TD>{b.group_label ?? b.group_type}</TD>
                <TD>
                  {b.drug_name ?? '—'}
                  {b.dose_amount ? ` ${b.dose_amount}${b.dose_unit ? ' ' + b.dose_unit : ''}` : ''}
                </TD>
                <TD>{b.animal_count ?? '—'}</TD>
                <TD>
                  {b.withdrawal_days && b.batch_date
                    ? addDays(b.batch_date, b.withdrawal_days)
                    : '—'}
                </TD>
                <TD>{b.administered_by ?? '—'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Panel>
  )
}
