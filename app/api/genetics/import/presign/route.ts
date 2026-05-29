export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!

export async function POST(req: NextRequest) {
  const { filename, contentType } = await req.json()

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 })
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `sire-pdfs/${Date.now()}-${safeFilename}`

  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(r2, command, { expiresIn: 300 })

  return NextResponse.json({ url, key })
}
