import { send, SANS } from '@/lib/emails'

/**
 * Transaction mail: the paper statement.
 *
 * The two moments an owner actually wants to hear from the ranch — cattle
 * bought, and cattle sold. Everything else (a weight recorded, a tub bought, a
 * calf weaned) is why the portal exists, and sending it is how an owner learns
 * to filter the ranch's address.
 *
 * These are deliberately NOT in the dark shell the invite and sign-in mail
 * use, which is why they live in their own file. Those are a door; these are a
 * document. Cream stock, a stamped seal, hairline rules and the figure set
 * large — something a man would print and put in the drawer with the brand
 * papers.
 */

const P_BACK  = '#e8e2d7'   // the paper it sits on
const P_CARD  = '#fbf8f2'   // the sheet
const P_INK   = '#1c1714'
const P_DIM   = '#78695c'
const P_RULE  = '#ddd3c4'
const P_EMBER = '#b4530f'

const SERIF = "Georgia,'Times New Roman',serif"

const money2 = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money0 = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

/**
 * The mark at the top of the sheet.
 *
 * The owner's own registered brand when the ranch holds one, and the ranch's
 * logo otherwise. A man's brand is the thing he recognises first, and on his
 * own statement it belongs to him rather than to the outfit billing him. Where
 * there is neither, the ring is drawn with his initials in it, so the
 * statement never opens with a broken image.
 */
function sealOf(opts: { brandUrl?: string | null; logoUrl?: string | null; initials: string }) {
  const src = (opts.brandUrl ?? '').trim() || (opts.logoUrl ?? '').trim()

  if (src) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>
      <td width="76" height="76" align="center" valign="middle"
          style="width:76px;height:76px;border:2px solid ${P_EMBER};border-radius:38px;padding:0;font-size:0;line-height:0">
        <img src="${src}" width="64" height="64" alt=""
             style="display:block;width:64px;height:64px;border-radius:32px;object-fit:cover">
      </td>
    </tr></table>`
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>
    <td width="76" height="76" align="center" valign="middle"
        style="width:76px;height:76px;border:2px solid ${P_EMBER};border-radius:38px;
               font-family:${SERIF};font-size:22px;font-weight:700;color:${P_EMBER};line-height:76px">${opts.initials}</td>
  </tr></table>`
}

/**
 * The owner's brand if the ranch holds one, else the ranch logo.
 *
 * Three columns because three paths write one: onboarding saves
 * brand_image_url, AddOwnerSheet saves brand_photo_url for an upload and
 * brand_drawing_url for one drawn on the pad. Same order the portal reads them
 * in, so the mark on the statement is the mark in the portal.
 */
export function brandForOwner(owner: {
  brand_image_url?: string | null
  brand_photo_url?: string | null
  brand_drawing_url?: string | null
} | null | undefined): string | null {
  return (owner?.brand_image_url   ?? '').trim()
      || (owner?.brand_photo_url   ?? '').trim()
      || (owner?.brand_drawing_url ?? '').trim()
      || null
}

export function initialsOf(name: string) {
  const parts = name.replace(/[^A-Za-z& ]/g, ' ').split(/\s+/).filter(Boolean)
  return (parts.slice(0, 2).map(p => p[0]).join('') || 'LL').toUpperCase()
}

/** The sheet itself. */
function sheet(opts: { preheader: string; body: string; ranchName: string }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<!-- Light by design. Clients that invert a cream sheet make a muddy one, so
     say which way round it goes and let the ones that listen behave. -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${opts.ranchName}</title>
</head>
<body style="margin:0;padding:0;background:${P_BACK}" bgcolor="${P_BACK}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${P_BACK}"
         style="background:${P_BACK};padding:32px 14px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${P_CARD}"
             style="max-width:460px;background:${P_CARD};border:1px solid ${P_RULE};border-radius:3px">
        <tr><td style="padding:34px 30px 30px">${opts.body}</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px">
        <tr><td style="padding:16px 8px 0;font-family:${SANS};font-size:11px;line-height:1.7;
                       color:${P_DIM};text-align:center">
          ${opts.ranchName} &middot; kept in BrandBook
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

const eyebrow = (t: string) =>
  `<p style="margin:20px 0 0;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.22em;
     text-transform:uppercase;color:${P_EMBER};text-align:center">${t}</p>`

const headline = (t: string) =>
  `<h1 style="margin:12px 0 0;font-family:${SERIF};font-size:29px;line-height:1.2;font-weight:400;
     color:${P_INK};text-align:center">${t}</h1>`

const standfirst = (t: string) =>
  `<p style="margin:12px 0 0;font-family:${SANS};font-size:13.5px;line-height:1.65;
     color:${P_DIM};text-align:center">${t}</p>`

const sectionLabel = (t: string) =>
  `<p style="margin:26px 0 0;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.18em;
     text-transform:uppercase;color:${P_DIM}">${t}</p>`

/** The heavy rule that opens a table of figures. */
const topRule = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0">
     <tr><td style="border-top:2px solid ${P_INK};font-size:0;line-height:0">&nbsp;</td></tr></table>`

/** One ruled line, with an optional round thumbnail. */
function sheetRow(opts: {
  title: string; sub?: string; amount: string
  photo?: string | null; thumbs?: boolean; strong?: boolean
}) {
  const thumb = opts.thumbs
    ? (opts.photo
        ? `<td width="50" style="padding:12px 12px 12px 0;font-size:0;line-height:0">
             <img src="${opts.photo}" width="38" height="38" alt=""
                  style="display:block;width:38px;height:38px;border-radius:19px;object-fit:cover;border:1px solid ${P_RULE}">
           </td>`
        // A head with no picture keeps the column, so the rows stay in line.
        : `<td width="50" style="padding:12px 12px 12px 0">
             <table role="presentation" cellpadding="0" cellspacing="0"><tr>
               <td width="38" height="38" style="width:38px;height:38px;border:1px dashed ${P_RULE};border-radius:19px;font-size:0;line-height:0">&nbsp;</td>
             </tr></table>
           </td>`)
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border-bottom:1px solid ${P_RULE}"><tr>
    ${thumb}
    <td style="padding:12px 0;font-family:${SANS};font-size:14px;line-height:1.35;color:${P_INK};
        font-weight:${opts.strong ? 700 : 600}">
      ${opts.title}
      ${opts.sub ? `<div style="font-size:11.5px;font-weight:400;color:${P_DIM};margin-top:3px">${opts.sub}</div>` : ''}
    </td>
    <td align="right" valign="top" style="padding:12px 0;font-family:${SERIF};font-size:16px;
        color:${P_INK};white-space:nowrap">${opts.amount}</td>
  </tr></table>`
}

/** Label left, figure large on the right. */
function totalRow(label: string, amount: string, accent = false) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
    <td style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.18em;
        text-transform:uppercase;color:${P_DIM}">${label}</td>
    <td align="right" style="font-family:${SERIF};font-size:30px;line-height:1.1;
        color:${accent ? P_EMBER : P_INK};white-space:nowrap">${amount}</td>
  </tr></table>`
}

function inkButton(href: string, text: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0"><tr>
    <td bgcolor="${P_INK}" style="background:${P_INK};border-radius:3px">
      <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:12px;
         font-weight:700;letter-spacing:.12em;color:${P_CARD};text-decoration:none">${text}</a>
    </td>
  </tr></table>`
}

const footNote = (t: string) =>
  `<p style="margin:20px 0 0;font-family:${SANS};font-size:11.5px;line-height:1.6;
     color:${P_DIM};text-align:center">${t}</p>`

export interface BoughtLine {
  /** 'Angus Cow' — breed and sex, from describeAnimal(). */
  title: string
  /** 'White Tag 2 · Daphne'. */
  tagLine: string
  amount: number | null
  photo?: string | null
}

export interface StatementBrand {
  /** The owner's own brand, if the ranch holds one. */
  brandUrl?: string | null
  /** The ranch logo, used when it does not. */
  logoUrl?: string | null
  /** For the drawn ring when there is neither. */
  ownerName: string
}

/**
 * Cattle bought.
 *
 * A pair is one line carrying the price, the same convention as the invoices
 * and the purchases report, so the three never disagree. Head is passed
 * separately because a pair is one line and two animals.
 */
export function purchaseEmail(opts: StatementBrand & {
  ranchName: string
  personName: string
  date: string
  seller: string
  lines: BoughtLine[]
  head: number
  total: number
  headAfter: number
  url: string
}) {
  const who = opts.personName ? `, ${opts.personName}` : ''
  const headWord = opts.head === 1 ? 'One head' : `${opts.head} head`

  return sheet({
    ranchName: opts.ranchName,
    preheader: `${headWord} from ${opts.seller} — ${money2(opts.total)}. Your herd stands at ${opts.headAfter}.`,
    body: `
      ${sealOf({ brandUrl: opts.brandUrl, logoUrl: opts.logoUrl, initials: initialsOf(opts.ownerName) })}
      ${eyebrow('Record of purchase')}
      ${headline(`Congratulations on your<br>new cattle${who}.`)}
      ${standfirst(`${headWord} from ${opts.seller}, ${opts.date}.`)}
      ${topRule()}
      ${opts.lines.map(l => sheetRow({
        title: l.title, sub: l.tagLine, photo: l.photo, thumbs: true,
        amount: l.amount == null ? '—' : money0(l.amount),
      })).join('')}
      ${totalRow('Total paid', money2(opts.total))}
      ${inkButton(opts.url, 'VIEW MY HERD')}
      ${footNote(`Your herd stands at ${opts.headAfter} head. Keep this for your records — it is also on your year-end report.`)}
    `,
  })
}

export async function sendPurchaseEmail(to: string, opts: Parameters<typeof purchaseEmail>[0]) {
  const who = opts.personName ? `, ${opts.personName}` : ''
  return send(to, `Congratulations on your new cattle${who} — ${opts.head} head`, purchaseEmail(opts))
}

export interface SoldLine {
  title: string
  tagLine: string
  /** 'By the head' or '612 lb at $2.45/lb'. */
  detail: string
  date: string
  amount: number
}

/** What the owner can have done with the proceeds. */
export interface PayoutChoice {
  key: 'check' | 'buy' | 'invoice'
  label: string
  sub: string
  href: string
}

/**
 * Cattle sold.
 *
 * Every head that went, what each brought and on what basis, then the fees
 * that actually applied to THIS sale, then the net — set large, because the
 * net is the number being looked for and burying it under an itemisation is
 * how an owner comes to believe the fees are hiding something.
 *
 * It ends by asking what he wants done with the money rather than leaving him
 * to ring up and ask.
 */
export function saleEmail(opts: StatementBrand & {
  ranchName: string
  personName: string
  buyer: string
  lines: SoldLine[]
  head: number
  gross: number
  fees: Array<{ label: string; amount: number }>
  feeTotal: number
  net: number
  payouts: PayoutChoice[]
  url: string
}) {
  const who = opts.personName ? `, ${opts.personName}` : ''
  const headWord = opts.head === 1 ? 'One head' : `${opts.head} head`

  const payoutButtons = opts.payouts.map((p, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>
      <td bgcolor="${i === 0 ? P_EMBER : P_CARD}"
          style="background:${i === 0 ? P_EMBER : P_CARD};border:1px solid ${i === 0 ? P_EMBER : P_RULE};border-radius:3px">
        <a href="${p.href}" style="display:block;padding:14px 18px;text-decoration:none;font-family:${SANS}">
          <span style="display:block;font-size:12px;font-weight:700;letter-spacing:.1em;
                color:${i === 0 ? '#ffffff' : P_INK}">${p.label}</span>
          <span style="display:block;font-size:11.5px;margin-top:3px;
                color:${i === 0 ? '#fbe3d2' : P_DIM}">${p.sub}</span>
        </a>
      </td>
    </tr></table>`).join('')

  return sheet({
    ranchName: opts.ranchName,
    preheader: `${headWord} sold for ${money2(opts.gross)}. Net to you ${money2(opts.net)}.`,
    body: `
      ${sealOf({ brandUrl: opts.brandUrl, logoUrl: opts.logoUrl, initials: initialsOf(opts.ownerName) })}
      ${eyebrow('Record of sale')}
      ${headline(`Congratulations${who}.`)}
      ${standfirst(`${headWord} sold to ${opts.buyer}.`)}
      ${topRule()}
      ${opts.lines.map(l => sheetRow({
        title: l.title, sub: `${l.tagLine} · ${l.detail} · ${l.date}`, amount: money0(l.amount),
      })).join('')}
      ${sheetRow({ title: 'Gross', sub: `${opts.head} head`, amount: money2(opts.gross), strong: true })}

      ${sectionLabel('Less fees')}
      ${opts.fees.length > 0
        ? opts.fees.map(f => sheetRow({ title: f.label, amount: `-${money2(f.amount)}` })).join('')
          + (opts.fees.length > 1
              ? sheetRow({ title: 'Total fees', amount: `-${money2(opts.feeTotal)}`, strong: true })
              : '')
        // Said rather than left blank: an owner who sees no fees should know it
        // was a decision, not an omission.
        : sheetRow({ title: 'None on this sale', sub: 'The cattle did not go through a barn.', amount: money2(0) })}

      ${totalRow('Net to you', money2(opts.net), true)}

      ${sectionLabel('What would you like done with it?')}
      <div style="height:9px"></div>
      ${payoutButtons}
      ${footNote('Pick one and we will take care of it. Nothing moves until you do.')}
    `,
  })
}

export async function sendSaleEmail(to: string, opts: Parameters<typeof saleEmail>[0]) {
  const who = opts.personName ? `, ${opts.personName}` : ''
  return send(to, `Congratulations${who} — ${opts.head} head sold, ${money2(opts.net)} net to you`, saleEmail(opts))
}
