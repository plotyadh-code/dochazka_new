import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminDochazkaPage() {
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
            <Link href="/admin/dochazka" className="text-blue-600 font-medium">Docházka</Link>
            <Link href="/admin/zamestnanci" className="text-gray-500 hover:text-gray-900">Zaměstnanci</Link>
          </nav>
        </div>
        <LogoutButton />
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <h1 className="text-lg font-semibold mb-4">Docházka zaměstnanců</h1>

        {!employees || employees.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">Zatím žádní zaměstnanci</p>
            <Link href="/admin/zamestnanci" className="text-blue-600 text-sm hover:underline">
              Přidat zaměstnance →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border divide-y">
            {employees.map((emp: Profile) => (
              <Link
                key={emp.id}
                href={`/admin/dochazka/${emp.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{emp.name}</p>
                  {emp.email && <p className="text-xs text-gray-400">{emp.email}</p>}
                </div>
                <span className="text-blue-600 text-sm">Zobrazit →</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
