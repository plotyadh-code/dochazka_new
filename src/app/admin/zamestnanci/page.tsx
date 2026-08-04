import { createClient } from '@/lib/supabase/server'
import CreateEmployeeForm from '@/components/CreateEmployeeForm'
import LogoutButton from '@/components/LogoutButton'
import PasswordCell from '@/components/PasswordCell'
import WorkModeSwitch from '@/components/WorkModeSwitch'
import Link from 'next/link'
import type { Profile, WorkModeRow } from '@/types'
import { resolveWorkMode } from '@/lib/workMode'

export const dynamic = 'force-dynamic'

export default async function ZamestnnaciPage() {
  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('name')

  const { data: workModes } = await supabase
    .from('employee_work_modes')
    .select('employee_id, year, month, mode')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const modesByEmployee = new Map<string, WorkModeRow[]>()
  for (const row of (workModes ?? []) as WorkModeRow[]) {
    const list = modesByEmployee.get(row.employee_id)
    if (list) list.push(row)
    else modesByEmployee.set(row.employee_id, [row])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-900">ADH-PLOTY</span>
          <nav className="flex gap-3 text-sm">
            <Link href="/admin/dochazka" className="text-gray-500 hover:text-gray-900">Docházka</Link>
            <Link href="/admin/zamestnanci" className="text-blue-600 font-medium">Zaměstnanci</Link>
          </nav>
        </div>
        <LogoutButton />
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-5">
        <CreateEmployeeForm />

        <div>
          <h2 className="text-base font-semibold mb-1">
            Zaměstnanci ({employees?.length ?? 0})
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Režim <strong className="text-gray-500">Zaměstnanec</strong> = 8 h/den, přesčasy, dovolená a nemocenská.
            Režim <strong className="text-gray-500">Hodinář</strong> = jen čisté odpracované hodiny (brigáda, fakturace).
            Přepnutí platí od aktuálního měsíce dál, historie zůstává.
          </p>
          {!employees || employees.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-400 text-sm">Zatím žádní zaměstnanci</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border divide-y">
              {employees.map((emp: Profile) => (
                <div key={emp.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      {emp.email && <p className="text-xs text-gray-400">{emp.email}</p>}
                      <PasswordCell password={emp.initial_password} />
                    </div>
                    <Link
                      href={`/admin/dochazka/${emp.id}`}
                      className="text-sm text-blue-600 hover:underline whitespace-nowrap"
                    >
                      Zobrazit docházku →
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t">
                    <span className="text-xs text-gray-500">Režim:</span>
                    <WorkModeSwitch
                      employeeId={emp.id}
                      year={currentYear}
                      month={currentMonth}
                      mode={resolveWorkMode(modesByEmployee.get(emp.id) ?? [], currentYear, currentMonth)}
                      size="sm"
                      showHint={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
