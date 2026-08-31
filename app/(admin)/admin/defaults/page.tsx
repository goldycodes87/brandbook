export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function DefaultsPage() {
  return (
    <AdminRoom
      href="/admin/defaults"
      title="DEFAULTS"
      subtitle="What a new animal starts as, so the tenth one takes four taps."
    >
      <NotMovedYet
        from="Settings → Ranch Profile"
        items={["Main breed and ear tag colour", "How you number cattle", "Registered stock", "Breeding method and preg-check interval", "Default AI technician"]}
      />
    </AdminRoom>
  )
}
