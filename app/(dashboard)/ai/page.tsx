export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { RancherChat } from '@/components/ai/RancherChat'

export default async function RancherAiPage() {
  // Operators only. RancherAI reads across the whole herd and every owner's
  // money, so an owner reaching it would see other people's cattle.
  const session = await getAdminSession()
  if (!session) redirect('/login')
  if (!session.canConfigure) redirect('/dashboard')

  return (
    <PageContainer>
      <PageHeader
        eyebrow="RANCHERAI"
        title="ASK"
        subtitle="Your records, answered out of the records themselves."
      />
      <RancherChat />
    </PageContainer>
  )
}
