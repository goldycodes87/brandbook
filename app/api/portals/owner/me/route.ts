export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The owner's own brand, for the watermark behind their portal. Fetched here
  // rather than carried on the session, which many other callers share and
  // none of the rest need widened.
  //
  // Three columns because three paths write one: onboarding saves
  // brand_image_url, AddOwnerSheet saves brand_photo_url for an upload and
  // brand_drawing_url for one drawn on the pad. Reading all three means an
  // owner sees their brand whichever door they came through; consolidating the
  // columns is a separate job from showing the picture.
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('grazing_owners')
    .select('brand_image_url, brand_photo_url, brand_drawing_url')
    .eq('id', session.id)
    .maybeSingle()

  const b = data as {
    brand_image_url: string | null
    brand_photo_url: string | null
    brand_drawing_url: string | null
  } | null

  const brand_url =
    (b?.brand_image_url   ?? '').trim() ||
    (b?.brand_photo_url   ?? '').trim() ||
    (b?.brand_drawing_url ?? '').trim() ||
    null

  return NextResponse.json({ owner: session, brand_url })
}
