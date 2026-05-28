export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toolbar } from '@/components/ui/Toolbar'
import { WithdrawalWidget } from '@/components/health/WithdrawalWidget'
import { HealthFilters } from '@/components/health/HealthFilters'
import { HealthAddButton } from '@/components/health/HealthAddButton'
import { BulkHealthEventSheet } from '@/components/health/BulkHealthEventSheet'
import { BatchHistoryPanel } from '@/components/health/BatchHistoryPanel'
import { HealthListClient } from '@/components/health/HealthListClient'

export default async function HealthPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Health"
        subtitle="Treatments, vaccinations &amp; withdrawal tracking"
        actions={
          <div className="flex items-center gap-2">
            <BulkHealthEventSheet />
            <HealthAddButton />
          </div>
        }
      />

      <div className="mb-5">
        <Suspense fallback={null}>
          <WithdrawalWidget />
        </Suspense>
      </div>

      <Toolbar className="mb-4" leading={<HealthFilters />} />

      <div className="mt-6 mb-2">
        <Suspense fallback={null}>
          <BatchHistoryPanel />
        </Suspense>
      </div>

      <Suspense fallback={
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      }>
        <HealthListClient />
      </Suspense>
    </PageContainer>
  )
}
