'use client'

import { useState } from 'react'
import { addHourlyAction, updateHourlyAction, deleteHourlyAction } from '@/app/admin/dochazka/actions'
import { formatCzk } from '@/lib/money'
import type { HourlyAction } from '@/types'

type Props = {
  employeeId: string
  year: number
  month: number
  actions: HourlyAction[]
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'

// AKCE Hodináře za měsíc — podklad pro fakturu. Admin může přidat, opravit i smazat.
export default function HourlyActionsAdmin({ employeeId, year, month, actions }: Props) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = actions.reduce((s, a) => s + Number(a.amount), 0)

  async function run(action: () => Promise<{ error?: string } | { success: boolean }>) {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      return false
    }
    return true
  }

  function startEdit(item: HourlyAction) {
    setEditId(item.id)
    setEditDescription(item.description)
    setEditAmount(String(item.amount))
    setError(null)
  }

  async function handleSave(id: number) {
    if (await run(() => updateHourlyAction(id, employeeId, editDescription, editAmount))) setEditId(null)
  }

  async function handleDelete(item: HourlyAction) {
    if (!confirm(`Smazat akci „${item.description}“ (${formatCzk(item.amount)})?`)) return
    await run(() => deleteHourlyAction(item.id, employeeId))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (await run(() => addHourlyAction(employeeId, year, month, newDescription, newAmount))) {
      setNewDescription('')
      setNewAmount('')
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">AKCE</span>
        <span className="text-xs text-gray-400">placené zakázkou, ne hodinově</span>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-gray-400">Tento měsíc žádné akce.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {actions.map(item => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 text-sm">
              {editId === item.id ? (
                <>
                  <input value={editDescription} onChange={e => setEditDescription(e.target.value)} className={`${inputClass} flex-1`} />
                  <input value={editAmount} onChange={e => setEditAmount(e.target.value)} inputMode="decimal" className={`${inputClass} sm:w-32`} />
                  <div className="flex gap-1">
                    <button onClick={() => handleSave(item.id)} disabled={busy} className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">Uložit</button>
                    <button onClick={() => setEditId(null)} disabled={busy} className="text-xs text-gray-600 px-2 py-1 rounded hover:bg-gray-100">Zrušit</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex-1 text-gray-700 break-words min-w-0">{item.description}</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap sm:w-32 sm:text-right">{formatCzk(item.amount)}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} disabled={busy} className="text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-50">Upravit</button>
                    <button onClick={() => handleDelete(item)} disabled={busy} className="text-xs text-red-600 px-2 py-1 rounded hover:bg-red-50">Smazat</button>
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 bg-gray-100 font-semibold text-sm">
            <span>Celkem za akce</span>
            <span>{formatCzk(total)}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 pt-1 border-t">
        <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Popis akce" className={`${inputClass} flex-1`} />
        <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Částka Kč" inputMode="decimal" className={`${inputClass} sm:w-32`} />
        <button type="submit" disabled={busy || !newDescription.trim() || !newAmount.trim()} className="text-sm bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg font-medium hover:bg-teal-100 disabled:opacity-50">
          + Přidat akci
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
