// Převod přesčasů mezi měsíci
//
// Zůstatek se NIKDY neukládá jako pevné číslo — vždy se dopočítá z docházky.
// Kdykoliv se změní záznam v minulém měsíci, další měsíce se opraví samy.
//
// Řetěz: carry(M) = mode(M-1) === 'carry' ? carry(M-1) + přesčas(M-1) : 0
//
// Režim "Proplatit / Převést" se stejně jako pracovní režim dědí dopředu —
// poslední nastavení platí i pro následující měsíce, dokud ho někdo nezmění.
// Není tedy nutné na konci každého měsíce znovu klikat na "Převést".

import { getCzechHolidays, isHoliday } from '@/lib/holidays'
import { resolveWorkMode, type WorkModeEntry } from '@/lib/workMode'

export type OvertimeMode = 'pay' | 'carry'

export const DEFAULT_OVERTIME_MODE: OvertimeMode = 'pay'

export type OvertimeModeEntry = {
  year: number
  month: number
  mode: OvertimeMode
}

/** Minimum, které z docházkového záznamu potřebujeme k výpočtu přesčasu. */
export type OvertimeSource = {
  date: string
  hours_worked: number | string
  overtime: number | string
  is_sick: boolean
}

function monthKey(year: number, month: number): number {
  return year * 12 + month
}

const holidayCache = new Map<number, Set<string>>()

function holidaysFor(year: number): Set<string> {
  let set = holidayCache.get(year)
  if (!set) {
    set = getCzechHolidays(year)
    holidayCache.set(year, set)
  }
  return set
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Přesčas za jeden den. O víkendu, o svátku a na nemocenské se do přesčasu
 * počítají celé odpracované hodiny (není povinných 8 h, které by se odečítaly).
 */
export function effectiveOvertime(record: OvertimeSource): number {
  const date = new Date(record.date + 'T00:00:00')
  const weekend = date.getDay() === 0 || date.getDay() === 6
  if (weekend || isHoliday(record.date, holidaysFor(date.getFullYear())) || record.is_sick) {
    return Number(record.hours_worked)
  }
  return Number(record.overtime)
}

/** Součet přesčasů za měsíc. Hodinář přesčasy nemá — vrací 0. */
export function monthOvertimeTotal(
  records: OvertimeSource[],
  year: number,
  month: number,
  workModes: WorkModeEntry[]
): number {
  if (resolveWorkMode(workModes, year, month) === 'hourly') return 0

  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  return round2(
    records.reduce((sum, r) => (r.date.startsWith(prefix) ? sum + effectiveOvertime(r) : sum), 0)
  )
}

/**
 * Režim přesčasů platný pro daný měsíc — poslední nastavení, které začíná
 * v tomto měsíci nebo dřív. Bez záznamu platí výchozí "Proplatit".
 */
export function resolveOvertimeMode(
  entries: OvertimeModeEntry[],
  year: number,
  month: number
): OvertimeMode {
  const target = monthKey(year, month)
  let best: OvertimeModeEntry | null = null

  for (const entry of entries) {
    const key = monthKey(entry.year, entry.month)
    if (key > target) continue
    if (!best || key > monthKey(best.year, best.month)) best = entry
  }

  return best?.mode ?? DEFAULT_OVERTIME_MODE
}

/**
 * Kolik hodin se převádí DO měsíce (year, month) — dopočítá se průchodem
 * všech předchozích měsíců od prvního záznamu docházky.
 *
 * `records` musí obsahovat celou historii zaměstnance až do konce
 * předchozího měsíce (na záznamech ze zobrazovaného měsíce nezáleží).
 */
export function computeCarriedIn(
  records: OvertimeSource[],
  modes: OvertimeModeEntry[],
  workModes: WorkModeEntry[],
  year: number,
  month: number
): number {
  const target = monthKey(year, month)

  let first: number | null = null
  for (const r of records) {
    const [y, m] = r.date.split('-').map(Number)
    if (!y || !m) continue
    const key = monthKey(y, m)
    if (key >= target) continue
    if (first === null || key < first) first = key
  }
  if (first === null) return 0

  let carry = 0
  for (let key = first; key < target; key++) {
    const y = Math.floor((key - 1) / 12)
    const m = key - y * 12

    // Hodinář nepřevádí nic — ani dovnitř, ani ven
    if (resolveWorkMode(workModes, y, m) === 'hourly') {
      carry = 0
      continue
    }

    const balance = round2(carry + monthOvertimeTotal(records, y, m, workModes))
    carry = resolveOvertimeMode(modes, y, m) === 'carry' ? balance : 0
  }

  return carry
}
