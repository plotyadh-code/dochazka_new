// Seznam zaměstnanců — řazení a rozdělení na aktivní / bývalé

import type { Profile } from '@/types'

/** Jméno je uložené vcelku („Jan Novák") — příjmení je poslední slovo. */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

/** Abecedně podle příjmení (česká abeceda), při shodě podle celého jména. */
export function sortBySurname<T extends Pick<Profile, 'name'>>(employees: T[]): T[] {
  return [...employees].sort(
    (a, b) =>
      surname(a.name).localeCompare(surname(b.name), 'cs') ||
      a.name.localeCompare(b.name, 'cs')
  )
}

/** Aktivní a bývalí zaměstnanci, obě skupiny seřazené podle příjmení. */
export function splitByActive<T extends Pick<Profile, 'name' | 'is_active'>>(employees: T[]) {
  const sorted = sortBySurname(employees)
  return {
    active: sorted.filter(e => e.is_active !== false),
    inactive: sorted.filter(e => e.is_active === false),
  }
}
