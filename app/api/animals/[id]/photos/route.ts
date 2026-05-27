export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const key = `animals/${id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadToR2(key, buffer, file.type)

  const { data: animal, error: fetchErr } = await supabase
    .from('animals')
    .select('photos')
    .eq('id', id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

  const photos = [...(animal.photos ?? []), url]
  const { error } = await supabase.from('animals').update({ photos }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url, photos })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const { url } = await req.json() as { url: string }

  const publicBase = process.env.R2_PUBLIC_URL!
  const key = url.replace(`${publicBase}/`, '')
  await deleteFromR2(key)

  const { data: animal, error: fetchErr } = await supabase
    .from('animals')
    .select('photos')
    .eq('id', id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

  const photos = (animal.photos ?? []).filter((p: string) => p !== url)
  const { error } = await supabase.from('animals').update({ photos }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ photos })
}
