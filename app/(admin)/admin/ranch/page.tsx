export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { RanchSettingsForm } from '@/components/admin/RanchSettingsForm'

export default function RanchPage() {
  return (
    <AdminRoom
      href="/admin/ranch"
      title="RANCH"
      subtitle="The name, address and brand every invite, invoice and report is stamped with."
    >
      <RanchSettingsForm show="profile" />
    </AdminRoom>
  )
}
