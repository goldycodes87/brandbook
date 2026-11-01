export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

/**
 * Where a brand inspection certificate goes up.
 *
 * Presigned and straight to R2, deliberately. The other document paths post
 * through a function, which caps the body at 4.5 MB and forces the file to be
 * shrunk before it is sent. That is the right trade for a photograph of a cow.
 * It is the wrong trade here: a brand inspection is the paper that proves who
 * owns the animal and that it was allowed to move, and the person reading it
 * later may be a brand inspector or a sheriff's deputy looking for a brand,
 * a signature and a hand-written tag number. So the camera's original goes up
 * untouched -- 9 MB, full resolution, no re-encode -- which only works because
 * the bytes never pass through a function.
 *
 * No animal id: the new-animal form can upload before the animal exists. The
 * key is random, and the URL is attached to the animal when the form saves.
 */

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

// A photograph or a scan. HEIC is included because an iPhone library will hand
// one over and there is nothing to decode here -- the bytes are only stored,
// never read by the model, so the format it cannot read does not matter.
const EXT: Record<string, string> = {
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'image/heic':      'heic',
  'image/heif':      'heif',
  'application/pdf': 'pdf',
}

export async function POST(req: NextRequest) {
  const { content_type } = await req.json() as { content_type?: string }

  if (!content_type) {
    return NextResponse.json({ error: 'content_type required' }, { status: 400 })
  }

  const ext = EXT[content_type]
  if (!ext) {
    return NextResponse.json(
      { error: 'A brand inspection must be a photo (JPG, PNG, WEBP, HEIC) or a PDF.' },
      { status: 400 },
    )
  }

  const key = `animals/brand-inspections/${Date.now()}-${randomUUID()}.${ext}`

  const presigned_url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket:      process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key:         key,
      ContentType: content_type,
    }),
    { expiresIn: 600 },   // a 9 MB file on a bar of signal takes a while
  )

  return NextResponse.json({
    presigned_url,
    public_url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`,
    key,
  })
}
