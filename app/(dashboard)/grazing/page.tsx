import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function GrazingPage() {
  return (
    <PageContainer>
      <PageHeader title="Grazing" />
      <EmptyState variant="neutral" title="Grazing" body="Coming soon" />
    </PageContainer>
  )
}
