'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { resolveWorkModeForDate, type WorkModeEntry } from '@/lib/workMode'

type Props = {
  employeeId: string
  modeEntries: WorkModeEntry[]
}

function getTodayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AttendanceForm({ employeeId, modeEntries }: Props) {
  const [date, setDate] = useState(getTodayDate())
  const [timeFrom, setTimeFrom] = useState('06:30')
  const [timeTo, setTimeTo] = useState('16:00')
  const [breakMinutes, setBreakMinutes] = useState<0 | 30 | 60>(30)
  const [location, setLocation] = useState('')
  const [isVacation, setIsVacation] = useState(false)
  const [isSick, setIsSick] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Režim platný pro zvolené datum — Hodinář zapisuje jen odpracované hodiny,
  // dovolenou ani nemocenskou nemá
  const isHourly = resolveWorkModeForDate(modeEntries, date) === 'hourly'
  const vacation = isHourly ? false : isVacation
  const sick = isHourly ? false : isSick

  function handleVacationChange(checked: boolean) {
    setIsVacation(checked)
    if (checked) {
      setIsSick(false)
      setTimeFrom('07:00')
      setTimeTo('15:00')
      setBreakMinutes(0)
    } else {
      setTimeFrom('06:30')
      setTimeTo('16:00')
      setBreakMinutes(30)
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
      setTimeFrom('06:30')
      setTimeTo('16:00')
      setBreakMinutes(30)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('auto_filled')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle()

    if (existing && !existing.auto_filled) {
      setError('Na tento den už máš záznam, který nelze přepsat.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('attendance_records').upsert(
      {
        employee_id: employeeId,
        date,
        time_from: vacation ? '07:00' : timeFrom,
        time_to: vacation ? '15:00' : timeTo,
        break_minutes: vacation ? 0 : breakMinutes,
        location: vacation ? 'DOVOLENÁ' : (location || null),
        is_sick: sick,
        submitted_at: new Date().toISOString(),
        auto_filled: false,
      },
      { onConflict: 'employee_id,date' }
    )

    if (error) {
      setError('Nastala chyba, zkus znovu.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setDate(getTodayDate())
    setTimeFrom('06:30')
    setTimeTo('16:00')
    setBreakMinutes(30)
    setLocation('')
    setIsVacation(false)
    setIsSick(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5 overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Zapsat docházku</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full max-w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od</label>
            <input
              type="time"
              value={vacation ? '07:00' : timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              disabled={vacation}
              className="w-full max-w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              required={!vacation}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do</label>
            <input
              type="time"
              value={vacation ? '15:00' : timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              disabled={vacation}
              className="w-full max-w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              required={!vacation}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Přestávka</label>
          <div className="flex gap-2">
            {([0, 30, 60] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => !vacation && setBreakMinutes(val)}
                disabled={vacation}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  (vacation ? 0 : breakMinutes) === val
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {val === 0 ? 'Žádná' : val === 30 ? '30 min' : '1 hod'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Místo výkonu práce</label>
          <input
            type="text"
            value={vacation ? 'DOVOLENÁ' : location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={vacation}
            className="w-full max-w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-orange-50 disabled:text-orange-600 disabled:border-orange-200 disabled:font-medium"
            placeholder={sick ? 'volitelné, např. home office' : 'např. Praha, Brno, home office...'}
          />
        </div>

        {isHourly && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            Zapisuješ jen odpracované hodiny — žádná povinná denní doba ani přesčasy.
          </p>
        )}

        {!isHourly && (
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
        )}

        {!isHourly && (
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
          <span className="text-xs text-gray-400 ml-auto">0 hod, jde-li se pracovat, počítá se jako přesčas</span>
        </label>
        )}

        {error &&<p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">Docházka byla zapsána!</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Odesílám...' : 'Odeslat docházku'}
        </button>
      </form>
    </div>
  )
}
