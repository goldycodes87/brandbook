export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { RanchSettingsForm } from '@/components/admin/RanchSettingsForm'

export default function DefaultsPage() {
  return (
    <AdminRoom
      href="/admin/defaults"
      title="DEFAULTS"
      subtitle="What a new animal starts as, so the tenth one takes four taps."
    >
      <RanchSettingsForm show="defaults" />
    </AdminRoom>
  )
}
