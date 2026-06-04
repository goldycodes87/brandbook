export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('expense_categories')
    .select('id, name, expense_type, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as { id: string; name: string; expense_type: string; sort_order: number | null }[]

  const grouped = {
    shared:          rows.filter(r => r.expense_type === 'shared'),
    owner_specific:  rows.filter(r => r.expense_type === 'owner_specific'),
    animal_specific: rows.filter(r => r.expense_type === 'animal_specific'),
  }

  return NextResponse.json({ data: grouped })
}
