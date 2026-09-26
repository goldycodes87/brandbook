export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Every change ever made to one animal.
 *
 * Read straight from record_changes, which is written by a database trigger —
 * so this shows edits from the animals API, Chute Mode, the bulk importer,
 * RancherAI and anything run by hand, without any of them having to remember
 * to report themselves.
 *
 * Raw field names and values go to the client. Turning owner_id into an owner
 * and a date string into "14 May" is presentation, and presentation belongs
 * where the rendering is.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100), 300)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('record_changes')
    .select('id, action, changed_fields, actor, changed_at')
    .eq('table_name', 'animals')
    .eq('row_id', id)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
