'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const INACTIVE_MESSAGE = 'Účet je deaktivovaný — obraťte se na vedoucího.'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Bývalý zaměstnanec má v Supabase Auth zablokované přihlášení (ban)
      setError(error.code === 'user_banned' || /banned/i.test(error.message) ? INACTIVE_MESSAGE : error.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Přihlášení selhalo')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profile?.is_active === false) {
      await supabase.auth.signOut()
      setError(INACTIVE_MESSAGE)
      setLoading(false)
      return
    }

    router.push(profile?.role === 'admin' ? '/admin' : '/dochazka')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border p-8 w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ADH-PLOTY</h1>
          <p className="text-gray-500 text-sm mt-1">Docházkový systém</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="vas@email.cz"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Přihlašuji...' : 'Přihlásit se'}
          </button>
        </form>
      </div>
    </div>
  )
}
