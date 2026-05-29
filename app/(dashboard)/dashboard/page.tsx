export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import Link from 'next/link'
import { Tag, AlertTriangle, FileText, MapPin, Calendar } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Toolbar } from '@/components/ui/Toolbar'
import { ButtonLink } from '@/components/ui/Button'
import { WeightLogSheet } from '@/components/weights/WeightLogSheet'
import { BulkHealthEventSheet } from '@/components/health/BulkHealthEventSheet'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

const DEFAULT_STATS = ['total_animals', 'cows_heifers', 'calves_born', 'active_leases']

const STAT_META: Record<string, { label: string; href: string; icon: React.ReactNode }> = {
  total_animals:      { label: 'Total Animals',      href: '/animals',        icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  active_bulls:       { label: 'Active Bulls',       href: '/animals?sex=bull', icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  cows_heifers:       { label: 'Cows & Heifers',     href: '/animals',        icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  calves:             { label: 'Calves',             href: '/animals',        icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  in_withdrawal:      { label: 'In Withdrawal',      href: '/health',         icon: <AlertTriangle size={16} style={{ color: 'var(--accent)' }} /> },
  open_invoices:      { label: 'Open Invoices',      href: '/billing',        icon: <FileText size={16} style={{ color: 'var(--accent)' }} /> },
  active_leases:      { label: 'Active Leases',      href: '/leases',         icon: <MapPin size={16} style={{ color: 'var(--accent)' }} /> },
  confirmed_pregnant: { label: 'Confirmed Pregnant', href: '/reproduction',   icon: <Calendar size={16} style={{ color: 'var(--accent)' }} /> },
  expected_calvings:  { label: 'Calvings (30 days)', href: '/reproduction',   icon: <Calendar size={16} style={{ color: 'var(--accent)' }} /> },
  calves_born:        { label: 'Calves Born',        href: '/animals',        icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStatValue(supabase: any, key: string): Promise<number> {
  const now          = new Date().toISOString().split('T')[0]
  const in30Days     = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const yearStart    = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]

  try {
    switch (key) {
      case 'total_animals': {
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true })
        return count ?? 0
      }
      case 'active_bulls': {
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('sex', 'bull')
        return count ?? 0
      }
      case 'cows_heifers': {
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true }).in('sex', ['cow', 'heifer'])
        return count ?? 0
      }
      case 'calves': {
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('sex', 'calf')
        return count ?? 0
      }
      case 'in_withdrawal': {
        const { count } = await supabase.from('health_events').select('id', { count: 'exact', head: true }).gte('withdrawal_clear_date', now)
        return count ?? 0
      }
      case 'open_invoices': {
        const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['draft', 'sent'])
        return count ?? 0
      }
      case 'active_leases': {
        const { count } = await supabase.from('leases').select('id', { count: 'exact', head: true }).gte('end_date', now)
        return count ?? 0
      }
      case 'confirmed_pregnant': {
        const { count } = await supabase.from('reproduction_events').select('id', { count: 'exact', head: true })
          .eq('event_type', 'preg_check').eq('result', 'positive')
        return count ?? 0
      }
      case 'expected_calvings': {
        const { count } = await supabase.from('reproduction_events').select('id', { count: 'exact', head: true })
          .not('expected_calving_date', 'is', null)
          .gte('expected_calving_date', now)
          .lte('expected_calving_date', in30Days)
        return count ?? 0
      }
      case 'calves_born': {
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true })
          .not('birth_date', 'is', null)
          .gte('birth_date', yearStart)
        return count ?? 0
      }
      default: return 0
    }
  } catch { return 0 }
}

async function DashboardStats() {
  const supabase = createAdminClient()

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('dashboard_stats')
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (prefs as any)?.dashboard_stats
  const selectedStats: string[] = Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_STATS

  const values = await Promise.all(
    selectedStats.map(key => fetchStatValue(supabase, key))
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {selectedStats.map((key, i) => {
        const meta = STAT_META[key]
        if (!meta) return null
        return (
          <Link key={key} href={meta.href} className="block">
            <StatCard label={meta.label} value={values[i]} aside={meta.icon} />
          </Link>
        )
      })}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createAdminClient()
  const { data: ranchSettings } = await supabase
    .from('ranch_settings')
    .select('owner_name, timezone')
    .maybeSingle()

  const timezone  = ranchSettings?.timezone ?? 'America/Denver'
  const ownerName = ranchSettings?.owner_name ?? ''

  const now  = new Date()
  const hour = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getHours()
  const greeting =
    hour >= 5 && hour < 12  ? 'Good morning'   :
    hour >= 12 && hour < 17 ? 'Good afternoon' :
    'Good evening'

  const subtitle = ownerName
    ? `${greeting}, ${ownerName}`
    : `${greeting} — Welcome to Brand Book`

  return (
    <PageContainer variant="narrow">
      <PageHeader title="Dashboard" subtitle={subtitle} />

      <Suspense fallback={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      }>
        <DashboardStats />
      </Suspense>

      <Toolbar
        className="mb-6"
        leading={
          <>
            <ButtonLink href="/animals/new" intent="primary" size="sm">+ ADD ANIMAL</ButtonLink>
            <ButtonLink href="/health" intent="secondary" size="sm">LOG HEALTH EVENT</ButtonLink>
            <BulkHealthEventSheet />
            <WeightLogSheet />
          </>
        }
      />

      <Panel title="RECENT ACTIVITY">
        <ActivityFeed />
      </Panel>
    </PageContainer>
  )
}
