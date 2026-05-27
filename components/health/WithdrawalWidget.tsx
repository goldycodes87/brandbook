import { createAdminClient } from '@/lib/supabase/admin'
import { ContextBanner } from '@/components/ui/ContextBanner'
import Link from 'next/link'

interface WithdrawalRow {
  id: string
  drug_name: string | null
  withdrawal_clear_date: string
  animal: { id: string; tag_number: string; name: string | null } | null
}

interface WithdrawalWidgetProps {
  animalId?: string
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysLeft(clearDate: string): number {
  const ms = new Date(clearDate + 'T00:00:00').getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export async function WithdrawalWidget({ animalId }: WithdrawalWidgetProps) {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from('health_events')
    .select('id, drug_name, withdrawal_clear_date, animal:animal_id ( id, tag_number, name )')
    .not('withdrawal_clear_date', 'is', null)
    .gte('withdrawal_clear_date', today)
    .order('withdrawal_clear_date', { ascending: true })

  if (animalId) query = query.eq('animal_id', animalId)

  const { data } = await query
  const rows = (data ?? []) as unknown as WithdrawalRow[]

  if (!rows.length) {
    return (
      <ContextBanner tone="success" title="No animals in withdrawal" />
    )
  }

  return (
    <ContextBanner tone="danger" emphasis eyebrow={`${rows.length} ANIMAL${rows.length !== 1 ? 'S' : ''} IN WITHDRAWAL`}>
      <div className="flex flex-col gap-1 mt-1">
        {rows.map(row => (
          <div key={row.id} className="flex items-center justify-between gap-2">
            <span>
              {row.animal ? (
                <Link
                  href={`/animals/${row.animal.id}`}
                  className="hover:underline font-semibold"
                  style={{ color: 'var(--danger-fg)' }}
                >
                  #{row.animal.tag_number}{row.animal.name ? ` — ${row.animal.name}` : ''}
                </Link>
              ) : '—'}
              {row.drug_name && <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>({row.drug_name})</span>}
            </span>
            <span className="shrink-0 type-helper" style={{ color: 'var(--danger-fg)' }}>
              {daysLeft(row.withdrawal_clear_date)}d · clear {fmtDate(row.withdrawal_clear_date)}
            </span>
          </div>
        ))}
      </div>
    </ContextBanner>
  )
}
