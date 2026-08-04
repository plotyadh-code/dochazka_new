import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AttendanceForm from '@/components/AttendanceForm'
import LogoutButton from '@/components/LogoutButton'
import type { AttendanceRecord, WorkModeRow } from '@/types'
import { resolveWorkModeForDate, resolveCurrentWorkMode, WORK_MODE_LABELS } from '@/lib/workMode'

function formatOvertime(overtime: number) {
  const sign = overtime >= 0 ? '+' : ''
  return `${sign}${Number(overtime).toFixed(2)}h`
}

export default async function DochazkaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', user.id)
    .order('date', { ascending: false })

  const { data: workModes } = await supabase
    .from('employee_work_modes')
    .select('employee_id, year, month, mode')
    .eq('employee_id', user.id)

  const modeEntries = (workModes ?? []) as WorkModeRow[]
  const currentMode = resolveCurrentWorkMode(modeEntries)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <span className="font-bold text-gray-900">ADH-PLOTY</span>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm text-gray-600 block leading-tight">{profile?.name}</span>
            {currentMode === 'hourly' && (
              <span className="text-xs text-teal-700">{WORK_MODE_LABELS.hourly}</span>
            )}
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-5">
        <AttendanceForm employeeId={user.id} modeEntries={modeEntries} />

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Moje záznamy</h2>
          {!records || records.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Zatím žádné záznamy</p>
          ) : (
            <div className="space-y-2">
              {records.map((record: AttendanceRecord) => {
                // Režim se bere podle měsíce záznamu, aby starší záznamy zůstaly tak, jak byly
                const recordMode = resolveWorkModeForDate(modeEntries, record.date)
                return (
                <div key={record.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{record.date}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {record.time_from} – {record.time_to} · přestávka {record.break_minutes} min
                      </p>
                      {recordMode === 'hourly'
                        ? record.location && <p className="text-xs text-gray-400 mt-0.5">{record.location}</p>
                        : record.location === 'DOVOLENÁ'
                        ? <span className="inline-block text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded mt-0.5">Dovolená</span>
                        : record.is_sick
                        ? <span className="inline-block text-xs font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded mt-0.5">Nemocenská{record.location ? ` · ${record.location}` : ''}</span>
                        : record.location && <p className="text-xs text-gray-400 mt-0.5">{record.location}</p>
                      }
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{Number(record.hours_worked).toFixed(2)}h</p>
                      {recordMode !== 'hourly' && (
                        <p className={`text-xs font-medium ${record.overtime >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatOvertime(record.overtime)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
