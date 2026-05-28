import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export interface VetSession {
  id: string
  name: string
  email: string | null
  practice_name: string | null
  license_number: string | null
}

export async function getVetSession(): Promise<VetSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('brandbook_vet_session')?.value
  if (!token) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vet_invites')
    .select('id, name, email, practice_name, license_number, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data || !data.accepted_at) return null

  return {
    id: data.id,
    name: data.name ?? 'Vet',
    email: data.email ?? null,
    practice_name: data.practice_name ?? null,
    license_number: data.license_number ?? null,
  }
}
