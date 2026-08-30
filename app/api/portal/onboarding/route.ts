export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPortalSession } from '@/lib/portal-auth'

/**
 * Onboarding reads and writes across three tables, and which one a field
 * belongs to is not obvious from its name:
 *
 *   portal_people       who the person is        — name, phone, licence, signature
 *   portal_memberships  this login at this ranch — notifications, onboarded_at
 *   grazing_owners      the herd                 — address, brand, tags, goals
 *
 * Putting notifications on the membership rather than the person is deliberate:
 * a vet at three outfits does not want the same alerts from all three.
 */

// GET — everything the flow needs to prefill itself.
export async function GET() {
  const s = await getPortalSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const [{ data: person }, { data: membership }, { data: ranch }] = await Promise.all([
    supabase.from('portal_people')
      .select('first_name, last_name, preferred_name, email, phone, contact_email, contact_text, practice_name, license_state, license_number, license_expires, signature_url')
      .eq('id', s.personId).maybeSingle(),
    supabase.from('portal_memberships').select('notify, onboarded_at').eq('id', s.membershipId).maybeSingle(),
    supabase.from('ranch_settings').select('ranch_name, logo_url, brand_photo_url').eq('id', s.ranchId).maybeSingle(),
  ])

  let owner = null
  if (s.role === 'owner' && s.ownerId) {
    const { data } = await supabase
      .from('grazing_owners')
      .select('company_name, address, city, state, zip, billing_address, brand_image_url, brand_source, default_ear_tag_color, default_tag_prefix, goals')
      .eq('id', s.ownerId).maybeSingle()
    owner = data
  }

  return NextResponse.json({
    role:      s.role,
    onboarded: s.onboarded,
    person,
    membership,
    owner,
    ranch,
  })
}

type Body = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const bool = (v: unknown) => Boolean(v)

// POST — save part of the flow. Called on every step, so it must be safe to
// call repeatedly and with only some of the fields present.
export async function POST(req: NextRequest) {
  const s = await getPortalSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Body = await req.json().catch(() => ({}))
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
  const supabase = createAdminClient()

  // ── The person ────────────────────────────────────────────────────────
  const person: Record<string, unknown> = {}
  if (has('first_name'))     person.first_name     = str(body.first_name)
  if (has('last_name'))      person.last_name      = str(body.last_name)
  if (has('preferred_name')) person.preferred_name = str(body.preferred_name)
  if (has('email'))          person.email          = str(body.email)
  if (has('phone'))          person.phone          = str(body.phone)
  if (has('contact_email'))  person.contact_email  = bool(body.contact_email)
  if (has('contact_text'))   person.contact_text   = bool(body.contact_text)

  // Vet-only. Guarded by role so an owner cannot write a licence onto
  // themselves by posting the field.
  if (s.role === 'vet') {
    if (has('practice_name'))   person.practice_name   = str(body.practice_name)
    if (has('license_state'))   person.license_state   = str(body.license_state)
    if (has('license_number'))  person.license_number  = str(body.license_number)
    if (has('license_expires')) person.license_expires = str(body.license_expires)
    if (has('signature_url'))   person.signature_url   = str(body.signature_url)
  }

  if (Object.keys(person).length > 0) {
    person.updated_at = new Date().toISOString()
    const { error } = await supabase.from('portal_people').update(person).eq('id', s.personId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── This login at this ranch ──────────────────────────────────────────
  if (has('notify')) {
    const { error } = await supabase
      .from('portal_memberships')
      .update({ notify: body.notify ?? {} })
      .eq('id', s.membershipId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── The herd ──────────────────────────────────────────────────────────
  if (s.role === 'owner' && s.ownerId) {
    const owner: Record<string, unknown> = {}
    if (has('company_name'))    owner.company_name = str(body.company_name)
    if (has('address'))         owner.address      = str(body.address)
    if (has('city'))            owner.city         = str(body.city)
    if (has('state'))           owner.state        = str(body.state)
    if (has('zip'))             owner.zip          = str(body.zip)
    // Unchecking "send my mail here too" is what makes a separate billing
    // address exist; checking it again clears the override rather than
    // leaving a stale one behind.
    if (has('billing_address')) owner.billing_address = str(body.billing_address)
    if (has('brand_image_url')) owner.brand_image_url = str(body.brand_image_url)
    if (has('brand_source'))    owner.brand_source    = str(body.brand_source)
    if (has('default_ear_tag_color')) owner.default_ear_tag_color = str(body.default_ear_tag_color)
    if (has('default_tag_prefix'))    owner.default_tag_prefix    = str(body.default_tag_prefix)
    if (has('goals')) {
      owner.goals = Array.isArray(body.goals) ? body.goals.filter(g => typeof g === 'string') : []
    }

    if (Object.keys(owner).length > 0) {
      const { error } = await supabase.from('grazing_owners').update(owner).eq('id', s.ownerId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // ── Finish ────────────────────────────────────────────────────────────
  // Only ever set here, and never unset: onboarding is what gates the flow, so
  // an accidental re-run would otherwise trap someone in it a second time.
  if (body.complete === true) {
    const { error } = await supabase
      .from('portal_memberships')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', s.membershipId)
      .is('onboarded_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, complete: body.complete === true })
}
