export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import Link from 'next/link'
import { Tag, AlertTriangle, FileText, MapPin, Calendar } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/ui/PageContainer'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Toolbar } from '@/components/ui/Toolbar'
import { ButtonLink } from '@/components/ui/Button'
import { WeightLogSheet } from '@/components/weights/WeightLogSheet'
import { BulkHealthEventSheet } from '@/components/health/BulkHealthEventSheet'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { RemindersWidget } from '@/components/dashboard/RemindersWidget'
import { ReceiptsWaiting } from '@/components/dashboard/ReceiptsWaiting'
import { MessagesCard } from '@/components/dashboard/MessagesCard'
import { RanchMasthead } from '@/components/dashboard/RanchMasthead'
import { BrandWatermark } from '@/components/brand/BrandWatermark'
import { HeroTiles } from '@/components/dashboard/HeroTiles'

// No "unbilled" tile here, deliberately. `invoice_id IS NULL` does not mean
// unbilled in this schema: generate-quarterly stamps invoice_id only on
// owner_specific and animal_specific rows, and tracks shared rows through
// expense_allocations instead. So a SUM over uninvoiced lease_expenses counts
// every hay and mineral row that Andy and Doug have already been invoiced AND
// paid for. A real receivable has to come from the allocation engine
// (lib/expense-allocation-data.ts), not an aggregate.
const DEFAULT_STATS = ['total_animals', 'cows_heifers', 'calves_born', 'active_leases']

const STAT_META: Record<string, { label: string; href: string; icon: React.ReactNode }> = {
  total_animals:      { label: 'Total Animals',      href: '/animals',          icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  active_bulls:       { label: 'Active Bulls',       href: '/animals?sex=bull', icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  cows_heifers:       { label: 'Cows & Heifers',     href: '/animals',          icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  calves:             { label: 'Calves',             href: '/animals',          icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
  in_withdrawal:      { label: 'In Withdrawal',      href: '/health',           icon: <AlertTriangle size={16} style={{ color: 'var(--accent)' }} /> },
  open_invoices:      { label: 'Open Invoices',      href: '/billing',          icon: <FileText size={16} style={{ color: 'var(--accent)' }} /> },
  active_leases:      { label: 'Active Leases',      href: '/leases',           icon: <MapPin size={16} style={{ color: 'var(--accent)' }} /> },
  confirmed_pregnant: { label: 'Confirmed Pregnant', href: '/reproduction',     icon: <Calendar size={16} style={{ color: 'var(--accent)' }} /> },
  expected_calvings:  { label: 'Calvings (30 days)', href: '/reproduction',     icon: <Calendar size={16} style={{ color: 'var(--accent)' }} /> },
  calves_born:        { label: 'Calves Born',        href: '/animals',          icon: <Tag size={16} style={{ color: 'var(--accent)' }} /> },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStatValue(supabase: any, key: string): Promise<number> {
  const now          = new Date().toISOString().split('T')[0]
  const in30Days     = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const yearStart    = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]

  try {
    switch (key) {
      case 'total_animals': {
        // Head on the ground, not rows in the table. A sold steer counted here
        // makes the dashboard disagree with the herd, with RancherAI, and with
        // what somebody sees out the window.
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true })
          .eq('status', 'active')
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
        // Was .eq('result', 'positive') — there is no `result` column and no
        // 'positive' value, so this threw, got swallowed by the catch below,
        // and read 0 on the dashboard all through calving planning. The column
        // is preg_check_result and the value is 'confirmed'.
        const { count } = await supabase.from('reproduction_events').select('id', { count: 'exact', head: true })
          .eq('event_type', 'preg_check').eq('preg_check_result', 'confirmed')
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
        // Was birth_date, which does not exist on animals. The column is dob.
        // Same silent zero as confirmed_pregnant above.
        const { count } = await supabase.from('animals').select('id', { count: 'exact', head: true })
          .not('dob', 'is', null)
          .gte('dob', yearStart)
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 sm:mb-6">
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
    .select('ranch_name, owner_name, logo_url, brand_photo_url, timezone')
    .maybeSingle()

  return (
    <PageContainer variant="narrow">
      {/* The watermark is positioned against this wrapper, not the viewport,
          so it travels with the content column instead of sliding around as
          the sidebar appears and disappears. */}
      <div className="relative overflow-hidden">
        <BrandWatermark src={ranchSettings?.brand_photo_url} />

        <div className="relative">
          <RanchMasthead
            ranchName={ranchSettings?.ranch_name ?? null}
            ownerName={ranchSettings?.owner_name ?? null}
            logoUrl={ranchSettings?.logo_url ?? null}
            brandUrl={ranchSettings?.brand_photo_url ?? null}
            timezone={ranchSettings?.timezone ?? 'America/Denver'}
          />

          {/* Ask and Chute Mode — the only two things here you press with a
              glove on. Everything below is read. */}
          <HeroTiles />

          {/* What is waiting on you. Receipts renders only when the queue is
              non-empty; Messages stays put so there is a door to it. */}
          <div className="flex flex-col gap-2.5 mb-5 sm:mb-6">
            <Suspense fallback={null}>
              <ReceiptsWaiting />
            </Suspense>
            <Suspense fallback={null}>
              <MessagesCard />
            </Suspense>
          </div>

          <Suspense fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 sm:mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
              ))}
            </div>
          }>
            <DashboardStats />
          </Suspense>

          <Toolbar
            className="mb-5 sm:mb-6"
            leading={
              <>
                <ButtonLink href="/animals/new" intent="primary" size="sm">+ ADD ANIMAL</ButtonLink>
                <ButtonLink href="/health" intent="secondary" size="sm">LOG HEALTH EVENT</ButtonLink>
                <BulkHealthEventSheet />
                <WeightLogSheet />
              </>
            }
          />

          <Suspense fallback={null}>
            <RemindersWidget />
          </Suspense>

          {/* A history, not a decision — it belongs where you sit down to
              review, not on a phone at the chute. */}
          <div className="hidden lg:block">
            <Panel title="RECENT ACTIVITY">
              <ActivityFeed />
            </Panel>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
