export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { BillingRatesRoom } from '@/components/admin/BillingRatesRoom'
import { getAdminSession } from '@/lib/admin-auth'

export default async function BillingRatesPage() {
  // The room itself is gated by AdminRoom; this only decides whether the CPA
  // who got in sees inputs or figures.
  const session = await getAdminSession()

  return (
    <AdminRoom
      href="/admin/billing"
      title="BILLING & RATES"
      subtitle="What the ranch charges, and what an expense can be filed under."
    >
      <BillingRatesRoom canEdit={Boolean(session?.canConfigure)} />
    </AdminRoom>
  )
}
