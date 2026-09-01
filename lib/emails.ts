import { Resend } from 'resend'

/**
 * Every email the app sends, in one house style.
 *
 * Written out as inline-styled HTML because that is what mail clients render:
 * Gmail strips <style> blocks, Outlook ignores flexbox, and a stylesheet is
 * the first thing to go. Tables and inline styles are not nostalgia here.
 *
 * The tone is a letter from the ranch, not a product announcement. Somebody
 * receiving this is being told their cattle records are somewhere new, and the
 * email that reads like marketing is the one that gets deleted or lands in
 * junk. No gradients, no hero image, one thing to press.
 */

const BRAND = '#ea580c'
const INK   = '#111111'
const MUTED = '#6b7280'
const RULE  = '#e5e7eb'

function shell(opts: {
  ranchName: string
  preheader: string
  body: string
}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${opts.ranchName}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
  <!-- The line the inbox shows beside the subject. Left blank and the client
       picks the first words of the body, which is rarely the useful part. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border:1px solid ${RULE};border-radius:10px">

        <tr><td style="padding:24px 28px 0">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:.16em;
                      text-transform:uppercase;color:${BRAND};font-weight:700">${opts.ranchName}</div>
          <div style="height:1px;background:${RULE};margin:16px 0 0"></div>
        </td></tr>

        <tr><td style="padding:22px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
                       Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${INK}">
          ${opts.body}
        </td></tr>

        <tr><td style="padding:0 28px 24px">
          <div style="height:1px;background:${RULE};margin-bottom:14px"></div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                      font-size:12px;line-height:1.6;color:${MUTED}">
            Sent by ${opts.ranchName} through BrandBook, the record book they keep their herd in.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`
}

/** One thing to press. A real anchor, because a styled div is not a link. */
function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0">
    <tr><td style="background:${BRAND};border-radius:6px">
      <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:-apple-system,
         BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;
         letter-spacing:.06em;color:#ffffff;text-decoration:none">${label}</a>
    </td></tr></table>`
}

/** The same URL in plain text, because some clients will not follow the button. */
function fallback(href: string) {
  return `<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">
    If the button does nothing, paste this into your browser:<br>
    <span style="color:${BRAND};word-break:break-all">${href}</span>
  </p>`
}

async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false as const, error: 'Email is not configured' }

  const resend = new Resend(key)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'BrandBook <noreply@brandbook.app>',
    to,
    subject,
    html,
  })
  if (error) {
    return { ok: false as const, error: (error as { message?: string }).message ?? 'That email did not send' }
  }
  return { ok: true as const }
}

// ─── What each role is actually being handed ─────────────────────────────────
//
// Said in the invite rather than discovered after signing in. Somebody deciding
// whether to click a link about their cattle deserves to know what it opens.
const ROLE_PITCH: Record<string, { title: string; line: string }> = {
  owner: {
    title: 'an Owner',
    line: 'You will see your own cattle — weights, health, breeding and calves — along with your invoices and what each shared expense cost you. Your animals only, nobody else’s.',
  },
  vet: {
    title: 'the Veterinarian',
    line: 'You will see health and breeding history for every animal on the place, and be able to record treatments and prescriptions. You will not see anybody’s money.',
  },
  cpa: {
    title: 'the accountant',
    line: 'You will see billing and the tax reports for the whole operation, read only. No animal records.',
  },
  co_admin: {
    title: 'Ranch Manager',
    line: 'You will be able to run the operation day to day — cattle, health, breeding, grazing and billing. Everything except bulk data import.',
  },
  admin: {
    title: 'an Admin',
    line: 'You will have the run of the place, including the settings and the data tools.',
  },
}

/**
 * The invitation.
 *
 * Names who is inviting, what the person is being invited AS, and what that
 * actually lets them see — then one link. No password to choose: the link is
 * how they get in, this time and every time.
 */
export function inviteEmail(opts: {
  ranchName: string
  inviterName: string
  personName: string
  role: string
  url: string
}) {
  const pitch = ROLE_PITCH[opts.role] ?? ROLE_PITCH.co_admin
  const greeting = opts.personName ? `${opts.personName},` : 'Hello,'

  return shell({
    ranchName: opts.ranchName,
    preheader: `${opts.inviterName} has invited you to ${opts.ranchName}’s records as ${pitch.title}.`,
    body: `
      <p style="margin:0 0 14px">${greeting}</p>
      <p style="margin:0 0 14px">
        ${opts.inviterName} has invited you to ${opts.ranchName}’s records as
        <strong>${pitch.title}</strong>.
      </p>
      <p style="margin:0 0 14px">${pitch.line}</p>
      ${button(opts.url, 'SET UP MY ACCESS')}
      <p style="margin:0 0 14px;font-size:13px;color:${MUTED}">
        There is no password to choose. This link signs you in, and we will send you
        a fresh one any time you need it.
      </p>
      ${fallback(opts.url)}
    `,
  })
}

export async function sendInviteEmail(to: string, opts: Parameters<typeof inviteEmail>[0]) {
  return send(to, `${opts.inviterName} invited you to ${opts.ranchName}`, inviteEmail(opts))
}

/** The link again, for somebody who already has access and lost the email. */
export function portalLinkEmail(opts: { ranchName: string; personName: string; url: string; minutes?: number }) {
  const greeting = opts.personName ? `${opts.personName},` : 'Hello,'
  return shell({
    ranchName: opts.ranchName,
    preheader: `Your link back into ${opts.ranchName}’s portal.`,
    body: `
      <p style="margin:0 0 14px">${greeting}</p>
      <p style="margin:0 0 14px">Here is your link back into the ${opts.ranchName} portal.</p>
      ${button(opts.url, 'OPEN MY PORTAL')}
      <p style="margin:0 0 14px;font-size:13px;color:${MUTED}">
        ${opts.minutes
          ? `Good for ${opts.minutes} minutes, and it replaces any earlier link.`
          : 'Keep it to yourself — anybody with this link can see your cattle records.'}
      </p>
      ${fallback(opts.url)}
    `,
  })
}

export async function sendPortalLinkEmail(to: string, opts: Parameters<typeof portalLinkEmail>[0]) {
  return send(to, `Your ${opts.ranchName} portal link`, portalLinkEmail(opts))
}

/** An operator who cannot remember their password, getting back to their own account. */
export function operatorLinkEmail(opts: { ranchName: string; personName: string; url: string; minutes: number }) {
  const greeting = opts.personName ? `${opts.personName},` : 'Hello,'
  return shell({
    ranchName: opts.ranchName,
    preheader: 'Sign in without your password, then set a new one.',
    body: `
      <p style="margin:0 0 14px">${greeting}</p>
      <p style="margin:0 0 14px">
        Use this to sign in without your password. Once you are in, set a new one under
        Settings, My Account.
      </p>
      ${button(opts.url, 'SIGN ME IN')}
      <p style="margin:0 0 14px;font-size:13px;color:${MUTED}">
        Good for ${opts.minutes} minutes and it works once. If you did not ask for this,
        nothing has changed on your account — but somebody typed your address, which is
        worth knowing.
      </p>
      ${fallback(opts.url)}
    `,
  })
}

export async function sendOperatorLinkEmail(to: string, opts: Parameters<typeof operatorLinkEmail>[0]) {
  return send(to, `Sign in to ${opts.ranchName}`, operatorLinkEmail(opts))
}

