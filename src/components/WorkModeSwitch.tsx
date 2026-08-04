'use client'

import { useState, useTransition } from 'react'
import { setWorkMode } from '@/app/admin/zamestnanci/actions'
import { WORK_MODE_LABELS, type WorkMode } from '@/lib/workMode'

const CZECH_MONTHS = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince']

type Props = {
  employeeId: string
  /** Měsíc, od kterého má změna platit (starší měsíce zůstávají beze změny). */
  year: number
  month: number
  mode: WorkMode
  size?: 'sm' | 'md'
  /** Zobrazit vysvětlivku, od kdy změna platí. */
  showHint?: boolean
}

export default function WorkModeSwitch({ employeeId, year, month, mode, size = 'md', showHint = true }: Props) {
  const [current, setCurrent] = useState<WorkMode>(mode)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const padding = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  function handleChange(next: WorkMode) {
    if (next === current || isPending) return
    const previous = current
    setCurrent(next)
    setError(null)
    startTransition(async () => {
      const result = await setWorkMode(employeeId, year, month, next)
      if (result && 'error' in result) {
        setCurrent(previous)
        setError(`Nepodařilo se uložit: ${result.error}`)
      }
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {(['employee', 'hourly'] as const).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            disabled={isPending}
            className={`${padding} rounded-lg font-medium transition-colors disabled:opacity-60 ${
              current === value
                ? value === 'hourly'
                  ? 'bg-teal-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {WORK_MODE_LABELS[value]}
          </button>
        ))}
        {isPending && <span className="text-xs text-gray-400">Ukládám…</span>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {showHint && !error && (
        <p className="text-xs text-gray-400">
          Změna platí od {CZECH_MONTHS[month - 1]} {year} dál — starší měsíce si drží svůj režim.
        </p>
      )}
    </div>
  )
}
