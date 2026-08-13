export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const contentType = req.headers.get('content-type') || ''

  // ── New flow: client already uploaded to R2, just save the public URL ──────
  if (contentType.includes('application/json')) {
    const { url } = await req.json() as { url: string }
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const { data: animal, error: fetchErr } = await supabase
      .from('animals').select('photos').eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

    const updatedPhotos = [...(animal.photos ?? []), url]
    const { error: updateError } = await supabase.from('animals').update({ photos: updatedPhotos }).eq('id', id)
    if (updateError) {
      console.error('[photo] DB save failed:', updateError.message)
      return NextResponse.json({ error: 'Failed to save photo to animal record' }, { status: 500 })
    }

    return NextResponse.json({ url, photos: updatedPhotos })
  }

  // ── Legacy flow: multipart upload via server (edit/new pages) ────────────
  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext    = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const key    = `animals/${id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const uploadedUrl = await uploadToR2(key, buffer, file.type)

  if (!uploadedUrl) {
    return NextResponse.json({ error: 'Upload failed — R2 returned no URL' }, { status: 500 })
  }

  const { data: animal, error: fetchErr } = await supabase
    .from('animals').select('photos').eq('id', id).single()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

  const updatedPhotos = [...(animal.photos ?? []), uploadedUrl]
  const { error: updateError } = await supabase.from('animals').update({ photos: updatedPhotos }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: uploadedUrl, photos: updatedPhotos })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const { url } = await req.json() as { url: string }

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!
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
