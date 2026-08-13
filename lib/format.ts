export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

export function fmtMoneyDecimals(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export function fmtMoneyZero(n: number | null | undefined): string {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

export function fmtTs(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function fmtDateShort(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit',
  })
}

export function calcAge(dob: string | null): string {
  if (!dob) return '—'
  const birth = new Date(dob + 'T00:00:00')
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) return 'Under 1 month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const yrs = Math.floor(months / 12)
  const mo = months % 12
  return mo ? `${yrs}yr ${mo}mo` : `${yrs} year${yrs === 1 ? '' : 's'}`
}
