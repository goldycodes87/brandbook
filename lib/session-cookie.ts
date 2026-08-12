/**
 * Signed session cookies.
 *
 * The session cookies used to hold a bare UUID (a Supabase user id, or a
 * grazing_owners id). Nothing validated them, so anyone could set the cookie
 * by hand and be treated as signed in. These helpers attach an HMAC so the
 * value cannot be forged without the server secret, and proxy.ts verifies it
 * at the edge — no database round trip, no per-route changes.
 *
 * Format: `<value>.<base64url HMAC-SHA256("v1:" + value)>`
 *
 * Key material: SESSION_SECRET if set (use it to rotate — rotating logs
 * everyone out, which is the point), otherwise SUPABASE_SECRET_KEY, which is
 * server-only and always present wherever this app runs. The "v1:" prefix is
 * domain separation so a signature can never be confused with any other use
 * of the same key.
 *
 * Runs on both the edge (middleware) and node (route handlers) — Web Crypto
 * only, no node:crypto import.
 */

const PREFIX = 'v1:'

function secretMaterial(): string | null {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || null
}

/** True when we have key material and can therefore verify strictly. */
export function signingAvailable(): boolean {
  return secretMaterial() !== null
}

function toBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(PREFIX + value))
  return toBase64Url(sig)
}

/** Constant-time-ish comparison, so a bad signature leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Sign a cookie value. If no key material exists the value is returned
 * unsigned rather than throwing, so a misconfigured environment degrades to
 * the previous behaviour instead of locking everyone out.
 */
export async function signSessionValue(value: string): Promise<string> {
  const secret = secretMaterial()
  if (!secret) {
    console.error('[session-cookie] no SESSION_SECRET or SUPABASE_SECRET_KEY — issuing UNSIGNED cookie')
    return value
  }
  return `${value}.${await hmac(value, secret)}`
}

/**
 * Verify a signed cookie and return the underlying value, or null.
 *
 * Returns null for a legacy unsigned cookie, which sends that user back to
 * the login page once; signing back in issues a signed cookie. That one-time
 * logout is the intended cost of the change.
 *
 * If key material is missing entirely we cannot verify anything, so we fall
 * back to accepting a non-empty value (the old presence check) rather than
 * hard-failing. That path is a misconfiguration, not something an attacker
 * can induce.
 */
export async function verifySessionValue(signed: string | undefined | null): Promise<string | null> {
  if (!signed) return null

  const secret = secretMaterial()
  if (!secret) {
    console.error('[session-cookie] no key material — accepting cookie WITHOUT verification')
    return signed.split('.')[0] || null
  }

  const idx = signed.lastIndexOf('.')
  if (idx <= 0) return null                       // unsigned / legacy

  const value = signed.slice(0, idx)
  const sig   = signed.slice(idx + 1)
  if (!value || !sig) return null

  return safeEqual(sig, await hmac(value, secret)) ? value : null
}
