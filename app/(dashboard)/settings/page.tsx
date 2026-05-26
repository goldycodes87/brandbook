import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" />
      <EmptyState variant="neutral" title="Settings" body="Coming soon" />
    </PageContainer>
  )
}
