import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export interface OwnerSession {
  id: string
  name: string
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies()
  const owner_id = cookieStore.get('brandbook_owner_session')?.value
  if (!owner_id) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data, error } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name')
    .eq('id', owner_id)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.company_name || data.owner_name || data.name || 'Owner',
  }
}
