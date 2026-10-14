// Výpočet Velikonoc algoritmem Anonymous Gregorian
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getCzechHolidays(year: number): Set<string> {
  const easter = easterSunday(year)
  const goodFriday = addDays(easter, -2)
  const easterMonday = addDays(easter, 1)

  const fixed = [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-05`,
    `${year}-07-06`,
    `${year}-09-28`,
    `${year}-10-28`,
    `${year}-11-17`,
    `${year}-12-24`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]

  return new Set([...fixed, toKey(goodFriday), toKey(easterMonday)])
}

export function isHoliday(dateStr: string, holidays: Set<string>): boolean {
  return holidays.has(dateStr)
}
