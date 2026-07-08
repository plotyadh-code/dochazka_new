import { createClient } from '@/lib/supabase/server'
import CreateEmployeeForm from '@/components/CreateEmployeeForm'
import LogoutButton from '@/components/LogoutButton'
import PasswordCell from '@/components/PasswordCell'
import Link from 'next/link'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ZamestnnaciPage() {
  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('name')

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
          <h2 className="text-base font-semibold mb-3">
            Zaměstnanci ({employees?.length ?? 0})
          </h2>
          {!employees || employees.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-gray-400 text-sm">Zatím žádní zaměstnanci</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border divide-y">
              {employees.map((emp: Profile) => (
                <div key={emp.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    {emp.email && <p className="text-xs text-gray-400">{emp.email}</p>}
                    <PasswordCell password={emp.initial_password} />
                  </div>
                  <Link
                    href={`/admin/dochazka/${emp.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Zobrazit docházku →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
