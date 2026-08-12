import type { CalendarEvent, CalendarProvider } from './types'

/** RFC 5545 wants CRLF, escaped separators, and lines folded at 75 octets. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

/** YYYY-MM-DD -> YYYYMMDD (all-day DATE value). */
const compact = (d: string) => d.replace(/-/g, '')

/** Day after `d`, since an all-day DTEND is exclusive. */
function nextDay(d: string): string {
  const dt = new Date(d + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10).replace(/-/g, '')
}

function stamp(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date(0)
  const safe = isNaN(d.getTime()) ? new Date(0) : d
  return safe.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export class IcsProvider implements CalendarProvider {
  readonly name = 'ics'
  readonly canPush = false

  render(events: CalendarEvent[], calendarName: string): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Brand Book//Ranch Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(calendarName)}`,
      // Hint to subscribers to re-poll roughly every 4 hours. Google treats
      // this as advisory and refreshes on its own schedule regardless.
      'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
      'X-PUBLISHED-TTL:PT4H',
    ]

    for (const e of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}@brandbook`,
        `DTSTAMP:${stamp(e.updatedAt)}`,
        `DTSTART;VALUE=DATE:${compact(e.date)}`,
        `DTEND;VALUE=DATE:${nextDay(e.date)}`,
        `SUMMARY:${escapeText(e.title)}`,
      )
      if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
      lines.push('END:VEVENT')
    }

    lines.push('END:VCALENDAR')
    return lines.map(fold).join('\r\n') + '\r\n'
  }
}
