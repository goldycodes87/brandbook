export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const formData = await req.formData()
  const file = formData.get('photo')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  }

  const ext    = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const key    = `sires/${id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const url    = await uploadToR2(key, buffer, file.type)

  const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from('sire_library')
    .update({ photo_url: url })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url })
}
