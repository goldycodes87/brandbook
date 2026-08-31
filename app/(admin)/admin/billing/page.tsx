export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function BillingRatesPage() {
  return (
    <AdminRoom
      href="/admin/billing"
      title="BILLING & RATES"
      subtitle="Every number the app needs before it can bill anybody."
    >
      <NotMovedYet
        from="three different Settings tabs"
        items={["Grazing rate per head per month", "AI technician fee", "Treatment labour per head", "Auction and private sale fees", "Expense categories and Schedule F lines"]}
      />
    </AdminRoom>
  )
}
