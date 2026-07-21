'use client'

import { useState, useTransition } from 'react'
import { upsertAttendanceRecord, deleteAttendanceRecord } from '@/app/admin/dochazka/actions'
import type { AttendanceRecord } from '@/types'

type Props = {
  employeeId: string
  date: string
  dateLabel: string
  record: AttendanceRecord | null
  onClose: () => void
}

export default function AttendanceEditModal({ employeeId, date, dateLabel, record, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const initVacation = record?.location === 'DOVOLENÁ'
  const [isVacation, setIsVacation] = useState(initVacation)
  const [isSick, setIsSick] = useState(record?.is_sick ?? false)
  const [timeFrom, setTimeFrom] = useState(record?.time_from?.slice(0, 5) ?? '07:00')
  const [timeTo, setTimeTo] = useState(record?.time_to?.slice(0, 5) ?? '16:00')
  const [breakMinutes, setBreakMinutes] = useState<number>(initVacation ? 30 : (record?.break_minutes ?? 30))
  const [location, setLocation] = useState(initVacation ? '' : (record?.location ?? ''))

  const [origValues] = useState({
    timeFrom: record?.time_from?.slice(0, 5) ?? '07:00',
    timeTo: record?.time_to?.slice(0, 5) ?? '16:00',
    breakMinutes: initVacation ? 30 : (record?.break_minutes ?? 30),
    location: initVacation ? '' : (record?.location ?? ''),
  })

  function handleVacationChange(checked: boolean) {
    setIsVacation(checked)
    if (checked) {
      setIsSick(false)
      setTimeFrom('07:00')
      setTimeTo('15:00')
      setBreakMinutes(0)
    } else {
      setTimeFrom(origValues.timeFrom)
      setTimeTo(origValues.timeTo)
      setBreakMinutes(origValues.breakMinutes)
      setLocation(origValues.location)
    }
  }

  function handleSickChange(checked: boolean) {
    setIsSick(checked)
    if (checked) {
      setIsVacation(false)
      setTimeFrom('07:00')
      setTimeTo('07:00')
      setBreakMinutes(0)
    } else {
      setTimeFrom(origValues.timeFrom)
      setTimeTo(origValues.timeTo)
      setBreakMinutes(origValues.breakMinutes)
      setLocation(origValues.location)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('employee_id', employeeId)
    formData.set('date', date)
    if (isVacation) {
      formData.set('time_from', '07:00')
      formData.set('time_to', '15:00')
      formData.set('break_minutes', '0')
      formData.set('location', 'DOVOLENÁ')
    } else {
      formData.set('time_from', timeFrom)
      formData.set('time_to', timeTo)
      formData.set('break_minutes', String(breakMinutes))
      formData.set('location', location)
    }
    formData.set('is_sick', String(isSick))
    startTransition(async () => {
      const result = await upsertAttendanceRecord(formData)
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  function handleDelete() {
    if (!record) return
    startTransition(async () => {
      const result = await deleteAttendanceRecord(record.id, employeeId)
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-base">
            {record ? 'Upravit záznam' : 'Přidat záznam'} — {dateLabel}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Od</label>
              <input
                type="time"
                value={isVacation ? '07:00' : timeFrom}
                onChange={e => setTimeFrom(e.target.value)}
                disabled={isVacation}
                required={!isVacation}
                className="w-full appearance-none border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Do</label>
              <input
                type="time"
                value={isVacation ? '15:00' : timeTo}
                onChange={e => setTimeTo(e.target.value)}
                disabled={isVacation}
                required={!isVacation}
                className="w-full appearance-none border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Přestávka</label>
            <select
              value={isVacation ? 0 : breakMinutes}
              onChange={e => setBreakMinutes(Number(e.target.value))}
              disabled={isVacation}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value={0}>0 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Místo práce</label>
            <input
              type="text"
              value={isVacation ? 'DOVOLENÁ' : location}
              onChange={e => setLocation(e.target.value)}
              disabled={isVacation}
              placeholder="Volitelné"
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-orange-50 disabled:text-orange-600 disabled:border-orange-200 disabled:font-medium"
            />
          </div>

          <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 rounded-lg border transition-colors ${
            isVacation
              ? 'border-orange-300 bg-orange-50'
              : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
          }`}>
            <input
              type="checkbox"
              checked={isVacation}
              onChange={e => handleVacationChange(e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span className={`text-sm font-medium ${isVacation ? 'text-orange-700' : 'text-gray-700'}`}>
              Dovolená
            </span>
            <span className="text-xs text-gray-400 ml-auto">7:00–15:00, 8 hod</span>
          </label>

          <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 rounded-lg border transition-colors ${
            isSick
              ? 'border-purple-300 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
          }`}>
            <input
              type="checkbox"
              checked={isSick}
              onChange={e => handleSickChange(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <span className={`text-sm font-medium ${isSick ? 'text-purple-700' : 'text-gray-700'}`}>
              Nemocenská
            </span>
            <span className="text-xs text-gray-400 ml-auto">0 hod, práce navíc = přesčas</span>
          </label>

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            {record && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                className="border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Smazat
              </button>
            )}
            {record && confirmDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Mažu…' : 'Potvrdit smazání'}
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
