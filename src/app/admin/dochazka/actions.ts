'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCzechHolidays, isHoliday } from '@/lib/holidays'
import { resolveOvertimeMode, type OvertimeModeEntry } from '@/lib/carryover'

export async function upsertAttendanceRecord(formData: FormData) {
  const employee_id = formData.get('employee_id') as string
  const date = formData.get('date') as string
  const time_from = formData.get('time_from') as string
  const time_to = formData.get('time_to') as string
  const break_minutes = parseInt(formData.get('break_minutes') as string, 10)
  const location = (formData.get('location') as string).trim() || null
  const is_sick = formData.get('is_sick') === 'true'

  if (!employee_id || !date || !time_from || !time_to) {
    return { error: 'Vyplňte všechna povinná pole' }
  }
  if (![0, 30, 60].includes(break_minutes)) {
    return { error: 'Neplatná hodnota přestávky' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('attendance_records')
    .upsert(
      { employee_id, date, time_from, time_to, break_minutes, location, is_sick, submitted_at: new Date().toISOString() },
      { onConflict: 'employee_id,date' }
    )

  if (error) return { error: error.message }
  revalidatePath(`/admin/dochazka/${employee_id}`)
  return { success: true }
}

export async function deleteAttendanceRecord(id: number, employeeId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('attendance_records').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/admin/dochazka/${employeeId}`)
  return { success: true }
}

/**
 * Uloží režim přesčasů pro daný měsíc — a nic víc.
 *
 * Zůstatek se nikde neukládá, dopočítává se při čtení (viz `@/lib/carryover`),
 * takže se sám opraví, když se starší měsíc dodatečně změní. Nastavení navíc
 * platí i pro následující měsíce, dokud ho někdo nezmění — není tedy nutné
 * na konci každého měsíce znovu klikat na "Převést".
 */
export async function setOvertimeMode(
  employeeId: string,
  year: number,
  month: number,
  mode: 'pay' | 'carry'
) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('monthly_overtime')
    .select('note')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const { error } = await supabase
    .from('monthly_overtime')
    .upsert(
      { employee_id: employeeId, year, month, mode, carried_in: 0, note: existing?.note ?? null },
      { onConflict: 'employee_id,year,month' }
    )
  if (error) return { error: error.message }

  revalidatePath(`/admin/dochazka/${employeeId}`)
  return { success: true }
}

export async function saveMonthNote(employeeId: string, year: number, month: number, note: string) {
  const supabase = await createClient()

  // Poznámka nesmí přepsat režim přesčasů — když pro měsíc ještě řádek není,
  // použije se režim zděděný z dřívějška, aby se nepřetrhl řetěz převodů.
  const { data: allModes } = await supabase
    .from('monthly_overtime')
    .select('year, month, mode')
    .eq('employee_id', employeeId)

  const mode = resolveOvertimeMode((allModes ?? []) as OvertimeModeEntry[], year, month)

  const { error } = await supabase
    .from('monthly_overtime')
    .upsert(
      { employee_id: employeeId, year, month, note, mode, carried_in: 0 },
      { onConflict: 'employee_id,year,month' }
    )
  if (error) return { error: error.message }

  revalidatePath(`/admin/dochazka/${employeeId}`)
  return { success: true }
}

export async function fillMonthWithDefaults(employeeId: string, year: number, month: number) {
  const supabase = await createClient()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: existing } = await supabase
    .from('attendance_records')
    .select('date')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)

  const existingDates = new Set((existing ?? []).map(r => r.date))
  const holidays = getCzechHolidays(year)

  const toInsert: { employee_id: string; date: string; time_from: string; time_to: string; break_minutes: number; submitted_at: string; auto_filled: boolean }[] = []

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue
    if (isHoliday(dateStr, holidays)) continue
    if (existingDates.has(dateStr)) continue
    toInsert.push({ employee_id: employeeId, date: dateStr, time_from: '07:00', time_to: '16:00', break_minutes: 60, submitted_at: new Date().toISOString(), auto_filled: true })
  }

  if (toInsert.length === 0) return { success: true, count: 0 }

  const { error } = await supabase.from('attendance_records').insert(toInsert)
  if (error) return { error: error.message }

  revalidatePath(`/admin/dochazka/${employeeId}`)
  return { success: true, count: toInsert.length }
}
