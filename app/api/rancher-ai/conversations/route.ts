export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * Earlier conversations, newest first.
 *
 * Titles come from the opening line, which is a decent handle for "the one
 * where I asked about Andy's bill" and a poor one for a conversation that
 * wandered. Good enough: the date and the first line together are how people
 * actually find a conversation again.
 */
export async function GET() {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, created_at, last_message_at')
    .eq('auth_user_id', session.authUserId)
    .order('last_message_at', { ascending: false })
    .limit(40)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Array<{
    id: string; title: string | null; created_at: string; last_message_at: string
  }>

  return NextResponse.json({
    data: rows.map(r => ({
      id: r.id,
      title: r.title || 'Untitled',
      // The date it was last touched is what somebody scans for.
      when: r.last_message_at,
    })),
  })
}
