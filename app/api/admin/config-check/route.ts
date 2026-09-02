export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * Which environment variables this deployment actually has.
 *
 * PRESENCE ONLY. Never a value, never a prefix, never a length — those are
 * enough to narrow a secret, and a page that leaks four characters of a
 * service-role key is worse than no page. The answer for every variable is a
 * boolean and nothing else.
 *
 * This exists because there is no way to read a Vercel environment from
 * outside it: the dashboard shows values to a human and the API needs a token
 * that is itself a secret. The deployment knows what it has, so the deployment
 * is asked.
 */

interface Check {
  name: string
  /** Why it exists, in one line. */
  purpose: string
  /** What is broken while it is unset. Empty when nothing is. */
  blocks: string
  group: 'Core' | 'Email' | 'Receipts' | 'Voice' | 'Storage' | 'Payments'
  required: boolean
}

const CHECKS: Check[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', group: 'Core', required: true,
    purpose: 'Where the database is.',
    blocks: 'Everything. The app cannot start.' },
  { name: 'SUPABASE_SECRET_KEY', group: 'Core', required: true,
    purpose: 'Server-side database access.',
    blocks: 'Everything. Every query fails.' },
  { name: 'NEXT_PUBLIC_APP_URL', group: 'Core', required: true,
    purpose: 'The address links in emails point at.',
    blocks: 'Invite and sign-in links fall back to the Vercel URL.' },
  { name: 'SESSION_SECRET', group: 'Core', required: true,
    purpose: 'Signs the session cookie.',
    blocks: 'Nothing visibly — it falls back to the database key, so both share one secret.' },
  { name: 'ANTHROPIC_API_KEY', group: 'Core', required: true,
    purpose: 'RancherAI, receipt parsing, tag reading.',
    blocks: 'RancherAI and every AI feature.' },

  { name: 'RESEND_API_KEY', group: 'Email', required: true,
    purpose: 'Sending mail.',
    blocks: 'Every email: invites, portal links, sign-in links, invoices.' },
  { name: 'RESEND_FROM_EMAIL', group: 'Email', required: true,
    purpose: 'Who mail comes from. Must be at a verified domain.',
    blocks: 'Mail is sent from a domain you do not own, so it bounces or lands in junk.' },
  { name: 'RESEND_FROM_PEOPLE', group: 'Email', required: false,
    purpose: 'Optional separate sender for invites and access mail, so they do not come from billing@.',
    blocks: '' },

  { name: 'RESEND_WEBHOOK_SECRET', group: 'Receipts', required: true,
    purpose: 'Verifies inbound mail really came from Resend.',
    blocks: 'Inbound receipts. The route refuses every payload without it.' },
  { name: 'RECEIPT_ALLOWED_SENDERS', group: 'Receipts', required: true,
    purpose: 'Who may forward a receipt in.',
    blocks: 'All receipts — an empty allowlist rejects every sender, including you.' },
  { name: 'CRON_SECRET', group: 'Receipts', required: true,
    purpose: 'Authenticates the nightly purge.',
    blocks: 'The 1-year retention sweep. It returns 500 every night.' },

  { name: 'NEXT_PUBLIC_VAPI_KEY', group: 'Voice', required: false,
    purpose: 'Starts a voice call from the browser.',
    blocks: 'Voice. The Talk tab says it is not switched on.' },
  { name: 'VAPI_WEBHOOK_SECRET', group: 'Voice', required: false,
    purpose: 'Lets Vapi run RancherAI tools mid-call.',
    blocks: 'Voice lookups. It can talk but cannot read the records.' },
  { name: 'VAPI_VOICE_PROVIDER', group: 'Voice', required: false,
    purpose: 'Defaults to Vapi’s own voices.', blocks: '' },
  { name: 'VAPI_VOICE_ID', group: 'Voice', required: false,
    purpose: 'Defaults to “Elliot”.', blocks: '' },

  { name: 'CLOUDFLARE_R2_ACCOUNT_ID', group: 'Storage', required: true,
    purpose: 'Where photos and receipt files live.',
    blocks: 'Photo upload and stored receipts.' },
  { name: 'CLOUDFLARE_R2_ACCESS_KEY_ID', group: 'Storage', required: true,
    purpose: 'R2 credentials.', blocks: 'Photo upload and stored receipts.' },
  { name: 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', group: 'Storage', required: true,
    purpose: 'R2 credentials.', blocks: 'Photo upload and stored receipts.' },
  { name: 'CLOUDFLARE_R2_BUCKET_NAME', group: 'Storage', required: true,
    purpose: 'Which bucket.', blocks: 'Photo upload and stored receipts.' },
  { name: 'NEXT_PUBLIC_R2_PUBLIC_URL', group: 'Storage', required: true,
    purpose: 'Where stored files are read back from.',
    blocks: 'Photos render as broken images.' },

  { name: 'SQUARE_ACCESS_TOKEN', group: 'Payments', required: false,
    purpose: 'Payment links on invoices.',
    blocks: 'Square payment links. Invoices still send.' },
  { name: 'SQUARE_LOCATION_ID', group: 'Payments', required: false,
    purpose: 'Which Square location.', blocks: 'Square payment links.' },
  { name: 'SQUARE_GRAZING_WEBHOOK_SECRET', group: 'Payments', required: false,
    purpose: 'Verifies Square payment callbacks.',
    blocks: 'Automatic marking of invoices as paid.' },
]

export async function GET() {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Read through a map built here rather than process.env[name]: a dynamic
  // lookup is exactly what an attacker would want if they could ever influence
  // `name`, and it also stops the bundler inlining anything unexpected.
  const present = (name: string) => {
    const v = process.env[name]
    return typeof v === 'string' && v.trim().length > 0
  }

  const data = CHECKS.map(c => ({
    name: c.name,
    group: c.group,
    purpose: c.purpose,
    blocks: c.blocks,
    required: c.required,
    set: present(c.name),
  }))

  const missingRequired = data.filter(d => d.required && !d.set)

  return NextResponse.json({
    data,
    summary: {
      total: data.length,
      set: data.filter(d => d.set).length,
      missingRequired: missingRequired.length,
      // Named so the panel can lead with what is actually broken.
      breaking: missingRequired.filter(d => d.blocks).map(d => d.blocks),
    },
    // Deliberately included: it is the difference between "this is not set" and
    // "this is not set HERE", which is the confusion this page exists to end.
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
  })
}
