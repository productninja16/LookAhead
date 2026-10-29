export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

/** Parse a YYYY-MM-DD string as a local date (avoids the UTC off-by-one of `new Date(str)`). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const shortDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const monthLabel = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export const daysLabel = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)
