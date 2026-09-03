'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { resolveWorkModeForDate, type WorkModeEntry } from '@/lib/workMode'

export type SubmitAttendanceInput = {
  date: string
  timeFrom: string
  timeTo: string
  breakMinutes: number
  location: string
  isVacation: boolean
  isSick: boolean
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Zápis vlastní docházky zaměstnancem.
 *
 * Zaměstnanec zapisuje jen sám za sebe — `employee_id` se bere z přihlášené
 * session, nikdy z parametru. Jednou odeslaný den už přepsat nelze (`auto_filled`
 * je pak false); opravu řeší admin. Totéž hlídají i RLS politiky v databázi
 * (migrace 008), tohle je první a srozumitelnější obrana.
 */
export async function submitAttendance(
  input: SubmitAttendanceInput
): Promise<{ error: string } | { success: true }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { supabase, userId } = auth

  const { date, timeFrom, timeTo, breakMinutes, location, isVacation, isSick } = input

  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    return { error: 'Neplatné datum.' }
  }
  if (![0, 30, 60].includes(breakMinutes)) {
    return { error: 'Neplatná hodnota přestávky.' }
  }
  if (!TIME_RE.test(timeFrom) || !TIME_RE.test(timeTo)) {
    return { error: 'Neplatný čas.' }
  }
  if (minutes(timeTo) < minutes(timeFrom)) {
    return { error: 'Čas "Do" nemůže být dřív než "Od".' }
  }

  // Režim platný pro zapisovaný den — Hodinář dovolenou ani nemocenskou nemá
  const { data: workModes } = await supabase
    .from('employee_work_modes')
    .select('year, month, mode')
    .eq('employee_id', userId)

  const isHourly = resolveWorkModeForDate((workModes ?? []) as WorkModeEntry[], date) === 'hourly'
  const vacation = isHourly ? false : isVacation
  const sick = isHourly ? false : isSick

  // Jednou odeslaný den je zamčený. Přepsat jde jen den předvyplněný adminem.
  const { data: existing } = await supabase
    .from('attendance_records')
    .select('auto_filled')
    .eq('employee_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (existing && !existing.auto_filled) {
    return { error: 'Na tento den už máš odeslaný záznam. Opravu domluv s adminem.' }
  }

  const { error } = await supabase.from('attendance_records').upsert(
    {
      employee_id: userId,
      date,
      time_from: vacation ? '07:00' : timeFrom,
      time_to: vacation ? '15:00' : timeTo,
      break_minutes: vacation ? 0 : breakMinutes,
      location: vacation ? 'DOVOLENÁ' : (location.trim() || null),
      is_sick: sick,
      submitted_at: new Date().toISOString(),
      auto_filled: false,
    },
    { onConflict: 'employee_id,date' }
  )

  if (error) return { error: 'Nastala chyba, zkus to znovu.' }

  revalidatePath('/dochazka')
  return { success: true }
}
