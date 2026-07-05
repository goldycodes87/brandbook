export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string }> }

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { filename, content_type } = await req.json() as { filename: string; content_type: string }

  if (!content_type) {
    return NextResponse.json({ error: 'content_type required' }, { status: 400 })
  }

  const ext = content_type === 'image/png' ? 'png' : content_type === 'image/webp' ? 'webp' : 'jpg'
  const key = `animals/${id}/photos/${Date.now()}-${randomUUID()}.${ext}`

  const command = new PutObjectCommand({
    Bucket:      process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key:         key,
    ContentType: content_type,
  })

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
  const publicUrl    = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

  console.log('[presign] key:', key, 'for animal:', id, 'original filename:', filename)
  return NextResponse.json({ presigned_url: presignedUrl, public_url: publicUrl, key })
}
