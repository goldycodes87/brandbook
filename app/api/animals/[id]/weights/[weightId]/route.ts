export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string; weightId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { weightId } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('weights').delete().eq('id', weightId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
