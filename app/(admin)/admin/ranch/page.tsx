export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { RanchSettingsForm } from '@/components/admin/RanchSettingsForm'
import { RanchContacts } from '@/components/admin/RanchContacts'

export default function RanchPage() {
  return (
    <AdminRoom
      href="/admin/ranch"
      title="RANCH"
      subtitle="The name, address and brand every invite, invoice and report is stamped with."
    >
      <RanchSettingsForm show="profile" />
      <div className="pb-8">
        <RanchContacts />
      </div>
    </AdminRoom>
  )
}
