export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'

export async function POST(req: NextRequest) {
  console.log('[upload-brand] route hit')
  try {
    const formData = await req.formData()
    const image    = formData.get('image')

    console.log('[upload-brand] image received:', image instanceof Blob ? `${image.size}b ${image.type}` : image)

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const ext = image.type === 'image/png'  ? 'png'
              : image.type === 'image/webp' ? 'webp'
              : image.type === 'image/gif'  ? 'gif'
              : 'jpg'

    const key    = `ranch/brand-${Date.now()}.${ext}`
    const buffer = Buffer.from(await image.arrayBuffer())
    const url    = await uploadToR2(key, buffer, image.type || 'image/png')

    console.log('[upload-brand] success:', url)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[upload-brand] error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
