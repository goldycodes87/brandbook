export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

// GET stays open — the invoice form and both expense sheets read this list.
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// Adding a category changes what every future expense can be filed under, so
// it is configuration rather than day-to-day entry.
export async function POST(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body     = await req.json()
  const supabase = createAdminClient()

  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name: body.name.trim(), description: body.description || null, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
