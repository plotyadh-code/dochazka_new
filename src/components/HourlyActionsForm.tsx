'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitHourlyAction } from '@/app/dochazka/actions'
import { formatCzk, parseAmount } from '@/lib/money'
import type { HourlyAction } from '@/types'

type Props = {
  actions: HourlyAction[]
}

const CZECH_MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']

// AKCE — práce placená zakázkou, ne hodinově. Bez data, patří do měsíce odeslání.
// Odeslané akce zůstávají vidět, opravit nebo smazat je může jen admin.
export default function HourlyActionsForm({ actions }: Props) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const canSubmit = description.trim() !== '' && parseAmount(amount) !== null

  // Seskupení podle měsíce (akce chodí seřazené od nejnovější)
  const groups: { key: string; label: string; items: HourlyAction[]; total: number }[] = []
  for (const action of actions) {
    const key = `${action.year}-${action.month}`
    let group = groups.find(g => g.key === key)
    if (!group) {
      group = { key, label: `${CZECH_MONTHS[action.month - 1]} ${action.year}`, items: [], total: 0 }
      groups.push(group)
    }
    group.items.push(action)
    group.total += Number(action.amount)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('Vyplň popis i částku akce.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess(false)

    const result = await submitHourlyAction(description, amount)

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setDescription('')
    setAmount('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5 overflow-hidden space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">AKCE</h2>
        <p className="text-xs text-gray-400 mt-0.5">Práce placená zakázkou, ne hodinově — např. „Akce Novák Humpolec“ 3 000 Kč.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full max-w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="např. Akce Novák Humpolec"
              required
            />
          </div>
          <div className="sm:w-36">
            <label className="block text-sm font-medium text-gray-700 mb-1">Částka (Kč)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full max-w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3 000"
              required
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">Akce byla zapsána!</p>}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full bg-teal-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Odesílám...' : 'Odeslat akci'}
        </button>
      </form>

      {groups.length > 0 && (
        <div className="space-y-3 pt-1 border-t">
          {groups.map(group => (
            <div key={group.key}>
              <div className="flex justify-between items-center text-sm font-semibold text-gray-700 py-1">
                <span>{group.label}</span>
                <span>{formatCzk(group.total)}</span>
              </div>
              <div className="divide-y rounded-lg border">
                {group.items.map(item => (
                  <div key={item.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-gray-700 break-words min-w-0">{item.description}</span>
                    <span className="font-medium text-gray-900 whitespace-nowrap">{formatCzk(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">Odeslanou akci už nejde změnit — opravu domluv s adminem.</p>
        </div>
      )}
    </div>
  )
}
