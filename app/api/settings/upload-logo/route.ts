export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image    = formData.get('image')

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const ext = image.type === 'image/png'  ? 'png'
              : image.type === 'image/webp' ? 'webp'
              : image.type === 'image/gif'  ? 'gif'
              : 'jpg'

    const key    = `ranch/logo-${Date.now()}.${ext}`
    const buffer = Buffer.from(await image.arrayBuffer())
    const url    = await uploadToR2(key, buffer, image.type || 'image/jpeg')

    const supabase = createAdminClient()
    const { data: existing } = await supabase.from('ranch_settings').select('id').limit(1).maybeSingle()
    if (existing) {
      await supabase.from('ranch_settings').update({ logo_url: url }).eq('id', existing.id)
    } else {
      await supabase.from('ranch_settings').insert({ logo_url: url })
    }

    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
