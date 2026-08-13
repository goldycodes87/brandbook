export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  // Unread vet messages (vet to rancher)
  const { count: vetCount } = await supabase
    .from('vet_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'vet_to_rancher')
    .is('read_at', null)

  // Unread owner messages (owner to rancher)
  const { count: ownerCount } = await supabase
    .from('owner_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'owner_to_rancher')
    .is('read_at', null)

  return NextResponse.json({ count: (vetCount ?? 0) + (ownerCount ?? 0) })
}
