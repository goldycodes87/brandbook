export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

/**
 * A thumbnail of something already in our own bucket.
 *
 * The transaction emails show each head at 38 pixels. They were pointing
 * straight at the originals, and the originals are what a phone camera
 * produces — Daphne's photograph is 9.1 MB. A five-head statement was asking
 * the reader's mail client to pull something like thirty megabytes to draw
 * five thumbnails the size of a thumbnail. On a phone in a pasture that does
 * not render at all; it times out, and the owner sees broken boxes where his
 * cattle should be.
 *
 * So the email asks for the size it is going to draw.
 *
 * ── Why this cannot take an arbitrary URL ─────────────────────────────────
 * It would be an open proxy: anyone could point it at an internal address and
 * read the response through us. It accepts a KEY within our own bucket and
 * builds the URL itself, so there is nothing to point anywhere else.
 */

const MAX_W = 1600
const ALLOWED = new Set([160, 320, 640, 1200])

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  if (!base) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const key = req.nextUrl.searchParams.get('key') ?? ''
  const wRaw = Number(req.nextUrl.searchParams.get('w') ?? 320)

  // No traversal, no scheme, no host. A key and nothing else.
  if (!key || key.includes('..') || key.startsWith('/') || /^[a-z]+:/i.test(key)) {
    return NextResponse.json({ error: 'bad key' }, { status: 400 })
  }
  // A fixed set of widths, so this cannot be used to burn CPU on a thousand
  // one-pixel variants of the same photograph.
  const w = ALLOWED.has(wRaw) ? wRaw : 320
  if (w > MAX_W) return NextResponse.json({ error: 'too wide' }, { status: 400 })

  const src = `${base.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`

  try {
    const upstream = await fetch(src, { cache: 'no-store' })
    if (!upstream.ok) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const type = upstream.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return NextResponse.json({ error: 'not an image' }, { status: 415 })

    const input = Buffer.from(await upstream.arrayBuffer())
    const out = await sharp(input)
      .rotate()                                    // honour EXIF, or half the cows come out sideways
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // The key carries the upload timestamp, so a given key never changes
        // its contents. Cache it as hard as the rules allow -- an owner's mail
        // client, and Gmail's image proxy, should each fetch it once.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
