export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function RanchPage() {
  return (
    <AdminRoom
      href="/admin/ranch"
      title="RANCH"
      subtitle="The name, address and brand every invite, invoice and report is stamped with."
    >
      <NotMovedYet
        from="Settings → Ranch Profile"
        items={["Ranch name, owner name, address, timezone", "Logo upload", "Ranch brand — photo or drawing"]}
      />
    </AdminRoom>
  )
}
