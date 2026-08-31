export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function OwnersPage() {
  return (
    <AdminRoom
      href="/admin/owners"
      title="OWNERS"
      subtitle="The people whose cattle you run, and the terms you run them on."
    >
      <NotMovedYet
        from="Settings → Custom Grazing"
        items={["Add and edit grazing owners", "Contracts, rates and sale fees", "Portal links and onboarding state", "Per-owner AI fee overrides"]}
      />
    </AdminRoom>
  )
}
