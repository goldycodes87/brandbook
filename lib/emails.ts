import { Resend } from 'resend'

/**
 * Every email the app sends, in the onboarding's clothes.
 *
 * The point is continuity: the email and the screen it opens should look like
 * the same object. So the values here are lifted from globals.css rather than
 * chosen again — #080808 ground, #111111 card, #ea580c accent, the hairline
 * rule under the wordmark, the outlined uppercase role pill. Somebody clicking
 * through should feel they arrived where they were already standing.
 *
 * Written as tables and inline styles because that is what mail clients
 * render: Gmail strips <style> blocks, Outlook ignores flexbox, and a
 * stylesheet is the first thing to go. Not nostalgia — the only thing that
 * works.
 *
 * Dark by design, which email is bad at. Two mitigations: color-scheme is
 * declared so clients that respect it stop trying to "help", and every surface
 * carries both a bgcolor attribute and an inline background, because Outlook
 * reads the attribute and ignores the style.
 */

// Straight from globals.css. If the app's palette moves, these move with it.
const GROUND  = '#080808'  // --surface-0
const CARD    = '#111111'  // --surface-1
const ACCENT  = '#ea580c'  // --accent
const TEXT    = '#f5f5f5'  // --text
const MUTED   = '#6b7280'  // --text-muted
const SECOND  = '#9ca3af'  // --text-secondary
const HAIRLINE = '#242424' // --border, flattened: rgba on black is unreliable in mail

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

/**
 * The mark, drawn in HTML.
 *
 * The real BrandBookMark is an inline SVG component and Gmail strips inline
 * SVG outright. A hosted PNG would need somewhere to host it and a URL that
 * outlives this deploy, so the branding iron is drawn instead: a ring with a
 * bar across it and a B beneath. Outlook squares off the border-radius and
 * that is the whole of the degradation.
 */
function mark() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
    <td width="60" height="60" align="center" valign="middle"
        style="width:60px;height:60px;border:2px solid ${ACCENT};border-radius:30px;
               font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;
               color:${ACCENT};line-height:60px">B</td>
  </tr></table>`
}

/** The 30px accent hairline the onboarding puts under its title. */
function rule() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto">
    <tr><td width="30" height="1" bgcolor="${ACCENT}"
            style="width:30px;height:1px;background:${ACCENT};opacity:.65;font-size:0;line-height:0">&nbsp;</td></tr>
  </table>`
}

/** The outlined uppercase pill, same as the onboarding's role chip. */
function pill(label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>
    <td style="border:1px solid ${ACCENT};border-radius:999px;padding:7px 16px;font-family:${SANS};
               font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;
               color:${ACCENT};white-space:nowrap">${label}</td>
  </tr></table>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 8px"><tr>
    <td bgcolor="${ACCENT}" style="border-radius:8px;background:${ACCENT}">
      <a href="${href}" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:13px;
         font-weight:700;letter-spacing:.1em;color:#ffffff;text-decoration:none">${label}</a>
    </td></tr></table>`
}

/** The same URL in text, because some clients will not follow a styled anchor. */
function fallback(href: string) {
  return `<p style="margin:20px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${MUTED};text-align:center">
    Or paste this into your browser<br>
    <span style="color:${SECOND};word-break:break-all">${href}</span>
  </p>`
}

function shell(opts: { ranchName: string; preheader: string; body: string }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<!-- Tells the clients that listen to stop inverting a design that is already dark. -->
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${opts.ranchName}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};" bgcolor="${GROUND}">
  <!-- The line the inbox shows beside the subject. Left out and the client
       picks the first words of the body, which is rarely the useful part. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${opts.preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${GROUND}"
         style="background:${GROUND};padding:36px 16px">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CARD}"
             style="max-width:480px;background:${CARD};border:1px solid ${HAIRLINE};border-radius:14px">
        <tr><td style="padding:36px 32px 32px">
          ${opts.body}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
        <tr><td style="padding:18px 8px 0;font-family:${SANS};font-size:11px;line-height:1.7;
                       color:${MUTED};text-align:center">
          Sent by ${opts.ranchName} through BrandBook — the book they keep the herd in.
        </td></tr>
      </table>

    </td></tr>
  </table>
</body></html>`
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
const ROLE_PITCH: Record<string, { pill: string; article: string; line: string }> = {
  owner: {
    pill: 'Owner',
    article: 'an',
    line: 'Your cattle — weights, health, breeding and calves — with your invoices and what each shared expense cost you. Your animals only, nobody else’s.',
  },
  vet: {
    pill: 'Veterinarian',
    article: 'a',
    line: 'Health and breeding history for every animal on the place, and somewhere to record treatments and prescriptions. You will not see anybody’s money.',
  },
  cpa: {
    pill: 'CPA',
    article: 'the',
    line: 'Billing and the tax reports for the whole operation, read only. No animal records.',
  },
  co_admin: {
    pill: 'Ranch Manager',
    article: 'the',
    line: 'The operation day to day — cattle, health, breeding, grazing and billing. Everything except the bulk data tools.',
  },
  admin: {
    pill: 'Admin',
    article: 'an',
    line: 'The run of the place, including the settings and the data tools.',
  },
}

const h1 = (text: string) =>
  `<h1 style="margin:0;font-family:${SANS};font-size:21px;font-weight:600;letter-spacing:.01em;
              color:${TEXT};text-align:center">${text}</h1>`

const lead = (text: string) =>
  `<p style="margin:10px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};
             text-align:center">${text}</p>`

/**
 * The invitation.
 *
 * Deliberately the same words and the same furniture as the onboarding's first
 * screen — mark, "Welcome to BrandBook", the hairline, who invited you, the
 * role pill. Clicking the button should feel like the page continued rather
 * than like arriving somewhere new.
 */
export function inviteEmail(opts: {
  ranchName: string
  inviterName: string
  personName: string
  role: string
  url: string
}) {
  const r = ROLE_PITCH[opts.role] ?? ROLE_PITCH.co_admin

  return shell({
    ranchName: opts.ranchName,
    preheader: `${opts.inviterName} has invited you to ${opts.ranchName} as ${r.article} ${r.pill}.`,
    body: `
      ${mark()}
      <div style="height:20px"></div>
      ${h1('Welcome to BrandBook')}
      ${lead('A modern cattle record keeping app.')}
      ${rule()}
      <p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.7;color:${SECOND};text-align:center">
        You&rsquo;ve been invited by<br>
        <strong style="color:${TEXT}">${opts.ranchName}</strong> as ${r.article}
      </p>
      ${pill(r.pill)}
      <p style="margin:22px 0 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${SECOND};text-align:center">
        ${r.line}
      </p>
      ${button(opts.url, 'SET UP MY ACCESS')}
      <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};text-align:center">
        No password to choose. This link signs you in, and we will send a fresh one whenever you need it.
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
    preheader: `Your link back into ${opts.ranchName}.`,
    body: `
      ${mark()}
      <div style="height:20px"></div>
      ${h1('Your way back in')}
      ${rule()}
      <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.7;color:${SECOND};text-align:center">
        ${greeting} here is your link back into the ${opts.ranchName} portal.
      </p>
      ${button(opts.url, 'OPEN MY PORTAL')}
      <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};text-align:center">
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
      ${mark()}
      <div style="height:20px"></div>
      ${h1('Sign in without your password')}
      ${rule()}
      <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.7;color:${SECOND};text-align:center">
        ${greeting} use this once to get in. It lands you on Settings with the password
        panel already open, so you can set a new one while you are there.
      </p>
      ${button(opts.url, 'SIGN ME IN')}
      <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};text-align:center">
        Good for ${opts.minutes} minutes and it works once. If you did not ask for this,
        nothing on your account has changed — but somebody typed your address, which is
        worth knowing.
      </p>
      ${fallback(opts.url)}
    `,
  })
}

export async function sendOperatorLinkEmail(to: string, opts: Parameters<typeof operatorLinkEmail>[0]) {
  return send(to, `Sign in to ${opts.ranchName}`, operatorLinkEmail(opts))
}
