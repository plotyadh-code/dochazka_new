import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import MonthlyAttendanceTable from '@/components/MonthlyAttendanceTable'
import type { Profile, AttendanceRecord, WorkModeRow } from '@/types'
import { resolveWorkMode } from '@/lib/workMode'
import { computeCarriedIn, resolveOvertimeMode, type OvertimeMode, type OvertimeSource } from '@/lib/carryover'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function EmployeeDochazkaPage({ params, searchParams }: Props) {
  const { id } = await params
  const { month: monthParam, year: yearParam } = await searchParams

  const now = new Date()
  const year = yearParam ? parseInt(yearParam) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1

  const supabase = await createClient()

  const { data: employee } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!employee) redirect('/admin/dochazka')

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  // Celá historie docházky před zobrazeným měsícem — z ní se dopočítá převod.
  // Díky tomu je zůstatek vždy aktuální, i když se starší měsíc dodatečně opraví.
  const { data: history } = await supabase
    .from('attendance_records')
    .select('date, hours_worked, overtime, is_sick')
    .eq('employee_id', id)
    .lt('date', startDate)
    .order('date')

  const { data: overtimeModes } = await supabase
    .from('monthly_overtime')
    .select('year, month, mode, note')
    .eq('employee_id', id)

  const { data: workModes } = await supabase
    .from('employee_work_modes')
    .select('employee_id, year, month, mode')
    .eq('employee_id', id)

  const workMode = resolveWorkMode((workModes ?? []) as WorkModeRow[], year, month)

  const modeEntries = (overtimeModes ?? []) as { year: number; month: number; mode: OvertimeMode; note: string | null }[]
  const carriedIn = computeCarriedIn(
    (history ?? []) as OvertimeSource[],
    modeEntries,
    (workModes ?? []) as WorkModeRow[],
    year,
    month
  )
  const overtimeMode = resolveOvertimeMode(modeEntries, year, month)
  const note = modeEntries.find(m => m.year === year && m.month === month)?.note ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-900">ADH-PLOTY</span>
          <nav className="flex gap-3 text-sm">
            <Link href="/admin/dochazka" className="text-blue-600 font-medium">Docházka</Link>
            <Link href="/admin/zamestnanci" className="text-gray-500 hover:text-gray-900">Zaměstnanci</Link>
          </nav>
        </div>
        <LogoutButton />
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/admin/dochazka" className="text-sm text-gray-500 hover:text-gray-900">← Zpět</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold">{employee.name}</h1>
        </div>

        <MonthlyAttendanceTable
          key={`${year}-${month}`}
          employee={employee as Profile}
          records={(records ?? []) as AttendanceRecord[]}
          year={year}
          month={month}
          employeeId={id}
          carriedIn={carriedIn}
          overtimeMode={overtimeMode}
          note={note}
          workMode={workMode}
        />
      </main>
    </div>
  )
}
