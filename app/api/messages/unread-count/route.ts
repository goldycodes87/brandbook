export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  // Unread = messages from vet to rancher that haven't been read
  const { count, error } = await supabase
    .from('vet_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'vet_to_rancher')
    .is('read_at', null)

  if (error) return NextResponse.json({ count: 0 })
  return NextResponse.json({ count: count ?? 0 })
}
