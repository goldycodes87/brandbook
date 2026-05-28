import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET     = process.env.CLOUDFLARE_R2_BUCKET_NAME!
const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  console.log('[r2] uploading:', key, contentType, body.length, 'bytes')
  console.log('[r2] account:', process.env.CLOUDFLARE_R2_ACCOUNT_ID?.slice(0, 8) + '...')
  console.log('[r2] bucket:', BUCKET)
  try {
    await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
    const url = `${PUBLIC_URL}/${key}`
    console.log('[r2] success:', url)
    return url
  } catch (err) {
    console.error('[r2] failed:', err)
    throw err
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
