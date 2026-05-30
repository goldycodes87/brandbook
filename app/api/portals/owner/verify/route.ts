export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false, error: 'Token required' }, { status: 400 })

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner } = await (supabase as any)
    .from('grazing_owners')
    .select('id, name, company_name, owner_name, email')
    .eq('portal_token', token)
    .maybeSingle()

  if (!owner) return NextResponse.json({ valid: false, error: 'Invalid or expired link' }, { status: 404 })

  return NextResponse.json({
    valid: true,
    owner: {
      id:   owner.id,
      name: owner.company_name || owner.owner_name || owner.name,
    },
  })
}
