export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { uploadToR2 } from '@/lib/r2'
import { getPortalSession } from '@/lib/portal-auth'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

// POST /api/portal/upload-image  (multipart, field "image")
//
// A brand or a signature, drawn or photographed by the person it belongs to.
// The admin route (/api/settings/upload-brand) needs an operator cookie, which
// a portal user does not have — so this is the same job behind the portal gate.
//
// Keyed by person id, so what an owner uploads lands nowhere near what another
// owner uploads even if both are called brand.png.
export async function POST(req: NextRequest) {
  const s = await getPortalSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'image required' }, { status: 400 })
  }

  const type = (file.type || '').toLowerCase()
  if (!ALLOWED.includes(type)) {
    return NextResponse.json({ error: 'PNG, JPG or WEBP only' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is over 8 MB' }, { status: 400 })
  }

  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  const key = `portal/${s.personId}/${Date.now()}-${randomUUID()}.${ext}`

  try {
    const url = await uploadToR2(key, Buffer.from(await file.arrayBuffer()), type)
    return NextResponse.json({ url, key })
  } catch (e) {
    console.error('[portal/upload-image]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
