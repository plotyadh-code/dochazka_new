'use client'

import { useState, useTransition } from 'react'
import { setEmployeeActive } from '@/app/admin/zamestnanci/actions'

type Props = {
  employeeId: string
  active: boolean
}

export default function ActiveToggle({ employeeId, active }: Props) {
  const [inactive, setInactive] = useState(!active)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: boolean) {
    if (isPending) return
    setInactive(next)
    setError(null)
    startTransition(async () => {
      const result = await setEmployeeActive(employeeId, !next)
      if (result && 'error' in result) {
        setInactive(!next)
        setError(`Nepodařilo se uložit: ${result.error}`)
      }
    })
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={inactive}
          onChange={e => handleChange(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 rounded border-gray-300"
        />
        Už nepracuje / vyřazen
        {isPending && <span className="text-gray-400">Ukládám…</span>}
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
