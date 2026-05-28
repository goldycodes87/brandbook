export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type FeedItem = {
  type: 'health' | 'weight' | 'animal' | 'repro'
  date: string
  label: string
  sub?: string | null
  animal?: { id: string; tag_number: string; name: string | null } | null
}

export async function GET() {
  const supabase = createAdminClient()

  const [healthRes, weightsRes, animalsRes, reproRes] = await Promise.all([
    supabase
      .from('health_events')
      .select('id, event_type, event_date, drug_name, animal:animal_id(id, tag_number, name)')
      .order('event_date', { ascending: false })
      .limit(15),
    supabase
      .from('weights')
      .select('id, weight_lbs, weighed_at, animal:animal_id(id, tag_number, name)')
      .order('weighed_at', { ascending: false })
      .limit(15),
    supabase
      .from('animals')
      .select('id, tag_number, name, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('reproduction_events')
      .select('id, event_type, event_date, animal:animal_id(id, tag_number, name)')
      .order('event_date', { ascending: false })
      .limit(15),
  ])

  const items: FeedItem[] = [
    ...(healthRes.data ?? []).map(e => ({
      type: 'health' as const,
      date: e.event_date as string,
      label: (e.event_type as string).replace(/_/g, ' '),
      sub: e.drug_name as string | null,
      animal: e.animal as unknown as { id: string; tag_number: string; name: string | null } | null,
    })),
    ...(weightsRes.data ?? []).map(e => ({
      type: 'weight' as const,
      date: (e.weighed_at as string).slice(0, 10),
      label: `${e.weight_lbs} lb weighed`,
      animal: e.animal as unknown as { id: string; tag_number: string; name: string | null } | null,
    })),
    ...(animalsRes.data ?? []).map(e => ({
      type: 'animal' as const,
      date: (e.created_at as string).slice(0, 10),
      label: `Animal added`,
      animal: { id: e.id, tag_number: e.tag_number as string, name: e.name as string | null },
    })),
    ...(reproRes.data ?? []).map(e => ({
      type: 'repro' as const,
      date: e.event_date as string,
      label: (e.event_type as string).replace(/_/g, ' '),
      animal: e.animal as unknown as { id: string; tag_number: string; name: string | null } | null,
    })),
  ]

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ items: items.slice(0, 15) })
}
