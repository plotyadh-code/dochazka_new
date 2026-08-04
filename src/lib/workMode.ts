// Pracovní režim zaměstnance
//
// 'employee' — Zaměstnanec: pravidla kalendáře (8 h/den, přesčasy, víkendy a svátky,
//              dovolená, nemocenská, převod přesčasů). Výchozí režim.
// 'hourly'   — Hodinář: brigádník / fakturant. Počítají se jen čisté odpracované
//              hodiny, žádná povinná denní doba, žádné přesčasy ani převody.
//
// Režim se ukládá jako "platí od tohoto měsíce dál" (tabulka employee_work_modes),
// takže změna režimu nikdy nepřepíše historii — starší měsíce si drží svůj režim.

export type WorkMode = 'employee' | 'hourly'

export const DEFAULT_WORK_MODE: WorkMode = 'employee'

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  employee: 'Zaměstnanec',
  hourly: 'Hodinář',
}

export type WorkModeEntry = {
  year: number
  month: number
  mode: WorkMode
}

function monthKey(year: number, month: number): number {
  return year * 12 + month
}

/**
 * Vrátí režim platný pro daný měsíc — poslední záznam, který začíná v tomto měsíci
 * nebo dřív. Pokud žádný takový není, platí výchozí režim Zaměstnanec.
 */
export function resolveWorkMode(entries: WorkModeEntry[], year: number, month: number): WorkMode {
  const target = monthKey(year, month)
  let best: WorkModeEntry | null = null

  for (const entry of entries) {
    const key = monthKey(entry.year, entry.month)
    if (key > target) continue
    if (!best || key > monthKey(best.year, best.month)) best = entry
  }

  return best?.mode ?? DEFAULT_WORK_MODE
}

/** Režim platný pro dnešní měsíc. */
export function resolveCurrentWorkMode(entries: WorkModeEntry[]): WorkMode {
  const now = new Date()
  return resolveWorkMode(entries, now.getFullYear(), now.getMonth() + 1)
}

/** Režim platný pro konkrétní datum ve formátu YYYY-MM-DD. */
export function resolveWorkModeForDate(entries: WorkModeEntry[], date: string): WorkMode {
  const [year, month] = date.split('-').map(Number)
  if (!year || !month) return DEFAULT_WORK_MODE
  return resolveWorkMode(entries, year, month)
}
