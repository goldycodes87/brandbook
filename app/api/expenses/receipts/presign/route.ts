export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  const { content_type } = await req.json() as { content_type: string }

  if (!content_type) {
    return NextResponse.json({ error: 'content_type required' }, { status: 400 })
  }

  const ext = content_type === 'image/png' ? 'png' : content_type === 'image/webp' ? 'webp' : 'jpg'
  const key = `expenses/receipts/${Date.now()}-${randomUUID()}.${ext}`

  const command = new PutObjectCommand({
    Bucket:      process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key:         key,
    ContentType: content_type,
  })

  const presigned_url = await getSignedUrl(s3, command, { expiresIn: 300 })
  const public_url    = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

  return NextResponse.json({ presigned_url, public_url, key })
}
