'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCzechHolidays, isHoliday } from '@/lib/holidays'

export async function upsertAttendanceRecord(formData: FormData) {
  const employee_id = formData.get('employee_id') as string
  const date = formData.get('date') as string
  const time_from = formData.get('time_from') as string
  const time_to = formData.get('time_to') as string
  const break_minutes = parseInt(formData.get('break_minutes') as string, 10)
  const location = (formData.get('location') as string).trim() || null

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
      { employee_id, date, time_from, time_to, break_minutes, location, submitted_at: new Date().toISOString() },
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

export async function setOvertimeMode(
  employeeId: string,
  year: number,
  month: number,
  mode: 'pay' | 'carry',
  carriedIn: number
) {
  const supabase = await createClient()

  const { error: e1 } = await supabase
    .from('monthly_overtime')
    .upsert(
      { employee_id: employeeId, year, month, mode, carried_in: carriedIn },
      { onConflict: 'employee_id,year,month' }
    )
  if (e1) return { error: e1.message }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: records } = await supabase
    .from('attendance_records')
    .select('date, overtime, hours_worked')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)

  const holidays = getCzechHolidays(year)
  const totalOvertime = (records ?? []).reduce((s, r) => {
    const d = new Date(r.date + 'T00:00:00')
    const dow = d.getDay()
    const weekend = dow === 0 || dow === 6
    const effective = (weekend || isHoliday(r.date, holidays))
      ? Number(r.hours_worked)
      : Number(r.overtime)
    return s + effective
  }, 0)
  const balance = Math.round((carriedIn + totalOvertime) * 100) / 100

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1

  const { data: existingNext } = await supabase
    .from('monthly_overtime')
    .select('mode')
    .eq('employee_id', employeeId)
    .eq('year', nextYear)
    .eq('month', nextMonth)
    .maybeSingle()

  const { error: e2 } = await supabase
    .from('monthly_overtime')
    .upsert(
      {
        employee_id: employeeId,
        year: nextYear,
        month: nextMonth,
        mode: existingNext?.mode ?? 'pay',
        carried_in: mode === 'carry' ? balance : 0,
      },
      { onConflict: 'employee_id,year,month' }
    )
  if (e2) return { error: e2.message }

  revalidatePath(`/admin/dochazka/${employeeId}`)
  return { success: true }
}

export async function saveMonthNote(employeeId: string, year: number, month: number, note: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('monthly_overtime')
    .select('mode, carried_in')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const { error } = await supabase
    .from('monthly_overtime')
    .upsert(
      {
        employee_id: employeeId,
        year,
        month,
        note,
        mode: existing?.mode ?? 'pay',
        carried_in: existing?.carried_in ?? 0,
      },
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
