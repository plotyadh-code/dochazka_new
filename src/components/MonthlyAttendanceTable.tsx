'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, AttendanceRecord } from '@/types'
import AttendanceEditModal from './AttendanceEditModal'
import WorkModeSwitch from './WorkModeSwitch'
import { setOvertimeMode, fillMonthWithDefaults, saveMonthNote } from '@/app/admin/dochazka/actions'
import { getCzechHolidays, isHoliday } from '@/lib/holidays'
import { WORK_MODE_LABELS, type WorkMode } from '@/lib/workMode'
import { effectiveOvertime as dayOvertime, round2 } from '@/lib/carryover'

type Props = {
  employee: Profile
  records: AttendanceRecord[]
  year: number
  month: number
  employeeId: string
  carriedIn: number
  overtimeMode: 'pay' | 'carry'
  note: string
  workMode: WorkMode
}

type EditDay = {
  date: string
  dateLabel: string
  record: AttendanceRecord | null
}

const CZECH_MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']
const CZECH_DAYS = ['Ne','Po','Út','St','Čt','Pá','So']

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const count = new Date(year, month, 0).getDate()
  for (let d = 1; d <= count; d++) {
    days.push(new Date(year, month - 1, d))
  }
  return days
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6
}

function fmtOvertime(val: number): string {
  return `${val >= 0 ? '+' : ''}${Number(val).toFixed(2)}`
}

function dateLabel(day: Date): string {
  return `${day.getDate()}. ${day.getMonth() + 1}.`
}

export default function MonthlyAttendanceTable({ employee, records, year, month, employeeId, carriedIn, overtimeMode, note, workMode }: Props) {
  const router = useRouter()
  const [editDay, setEditDay] = useState<EditDay | null>(null)
  const [mode, setMode] = useState<'pay' | 'carry'>(overtimeMode)
  const [isPending, startTransition] = useTransition()
  const [fillStatus, setFillStatus] = useState<string | null>(null)
  const [noteText, setNoteText] = useState(note)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [modeError, setModeError] = useState<string | null>(null)
  const days = getDaysInMonth(year, month)

  // Hodinář — jen čisté odpracované hodiny, žádná pravidla kalendáře
  // (povinných 8 h, přesčasy, svátky, převody, dovolená ani nemocenská).
  const isHourly = workMode === 'hourly'

  const recordMap = new Map<string, AttendanceRecord>()
  records.forEach(r => recordMap.set(r.date, r))

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

  const holidays = getCzechHolidays(year)

  function effectiveOvertime(record: AttendanceRecord): number {
    if (isHourly) return 0
    return dayOvertime(record)
  }

  const totalHours = records.reduce((s, r) => s + Number(r.hours_worked || 0), 0)
  const totalOvertime = isHourly ? 0 : round2(records.reduce((s, r) => s + dayOvertime(r), 0))
  const totalBalance = round2(carriedIn + totalOvertime)

  async function handleFillMonth() {
    if (!confirm(`Vyplnit všechny prázdné pracovní dny v ${CZECH_MONTHS[month - 1]} ${year} hodnotami 07:00–16:00, přestávka 60 min?`)) return
    setFillStatus('Vyplňuji...')
    const result = await fillMonthWithDefaults(employeeId, year, month)
    if ('error' in result) {
      setFillStatus(`Chyba: ${result.error}`)
    } else {
      setFillStatus(result.count === 0 ? 'Žádné prázdné dny k vyplnění.' : `Vyplněno ${result.count} dní.`)
    }
    setTimeout(() => setFillStatus(null), 4000)
  }

  function handleModeChange(newMode: 'pay' | 'carry') {
    const previousMode = mode
    setMode(newMode)
    setModeError(null)
    startTransition(async () => {
      const result = await setOvertimeMode(employeeId, year, month, newMode)
      if (!result || !('error' in result)) router.refresh()
      if (result && 'error' in result) {
        setMode(previousMode)
        setModeError(`Nepodařilo se uložit: ${result.error}`)
      }
    })
  }

  async function downloadWorkbook(wb: { xlsx: { writeBuffer: () => Promise<ArrayBuffer> } }) {
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dochazka_${employee.name.replace(/\s+/g, '_')}_${year}_${String(month).padStart(2, '0')}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Export pro Hodináře — jen dny a odpracované hodiny, bez přesčasů,
  // typu dne a převodů. Víkendy jsou jen šedě odlišené kvůli čitelnosti.
  async function handleExportHourly() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'ADH-PLOTY Docházkový systém'
    const ws = wb.addWorksheet(`${CZECH_MONTHS[month - 1]} ${year}`)

    ws.columns = [
      { header: 'Datum', key: 'datum', width: 10 },
      { header: 'Den', key: 'den', width: 6 },
      { header: 'Od', key: 'od', width: 8 },
      { header: 'Do', key: 'do_', width: 8 },
      { header: 'Přestávka (min)', key: 'prestav', width: 17 },
      { header: 'Odpracováno (h)', key: 'odprac', width: 17, style: { numFmt: '0.00' } },
      { header: 'Místo práce', key: 'misto', width: 25 },
      { header: 'Čas zápisu', key: 'zapis', width: 20 },
    ]

    const headerRow = ws.getRow(1)
    headerRow.height = 22
    headerRow.font = { bold: true, size: 12, color: { argb: 'FF1A1A1A' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2E0DA' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F766E' } },
        left: { style: 'thin' },
        bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
        right: { style: 'thin' },
      }
    })

    let workedDays = 0

    days.forEach(day => {
      const dateStr = fmt(day)
      const r = recordMap.get(dateStr)
      if (r) workedDays++

      const row = ws.addRow({
        datum: dateLabel(day),
        den: CZECH_DAYS[day.getDay()],
        od: r?.time_from?.slice(0, 5) ?? '',
        do_: r?.time_to?.slice(0, 5) ?? '',
        prestav: r !== undefined ? r.break_minutes : null,
        odprac: r ? Number(r.hours_worked) : null,
        misto: r?.location ?? '',
        zapis: r?.submitted_at ? new Date(r.submitted_at).toLocaleString('cs-CZ') : '',
      })

      if (isWeekend(day)) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
        row.font = { color: { argb: 'FF777777' } }
      }

      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      })
    })

    ws.addRow({})

    const totalRow = ws.addRow({
      datum: 'CELKEM',
      odprac: totalHours,
      misto: employee.name,
      zapis: `${CZECH_MONTHS[month - 1]} ${year}`,
    })
    totalRow.font = { bold: true, size: 12 }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2E0DA' } }
    totalRow.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F766E' } },
        left: { style: 'thin' },
        bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
        right: { style: 'thin' },
      }
    })

    const daysRow = ws.addRow({ datum: `Odpracovaných dní: ${workedDays}` })
    ws.mergeCells(`A${daysRow.number}:H${daysRow.number}`)
    daysRow.font = { bold: true }
    daysRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F5F3' } }

    const modeRow = ws.addRow({ datum: 'Režim: Hodinář — jen odpracované hodiny, bez povinné denní doby a přesčasů' })
    ws.mergeCells(`A${modeRow.number}:H${modeRow.number}`)
    modeRow.font = { italic: true, size: 10, color: { argb: 'FF777777' } }

    await downloadWorkbook(wb)
  }

  async function handleExport() {
    if (isHourly) return handleExportHourly()

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'ADH-PLOTY Docházkový systém'
    const ws = wb.addWorksheet(`${CZECH_MONTHS[month - 1]} ${year}`)

    ws.columns = [
      { header: 'Datum', key: 'datum', width: 10 },
      { header: 'Den', key: 'den', width: 6 },
      { header: 'Od', key: 'od', width: 8 },
      { header: 'Do', key: 'do_', width: 8 },
      { header: 'Přestávka (min)', key: 'prestav', width: 17 },
      { header: 'Odpracováno (h)', key: 'odprac', width: 17, style: { numFmt: '0.00' } },
      { header: 'Přesčas (h)', key: 'presac', width: 13, style: { numFmt: '+0.00;-0.00;0.00' } },
      { header: 'Místo práce', key: 'misto', width: 25 },
      { header: 'Čas zápisu', key: 'zapis', width: 20 },
      { header: 'Typ dne', key: 'typ', width: 14 },
    ]

    // Styl hlavičky
    const headerRow = ws.getRow(1)
    headerRow.height = 22
    headerRow.font = { bold: true, size: 12, color: { argb: 'FF1A1A1A' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8CCE4' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF4472C4' } },
        left: { style: 'thin' },
        bottom: { style: 'medium', color: { argb: 'FF4472C4' } },
        right: { style: 'thin' },
      }
    })

    // Datové řádky
    days.forEach(day => {
      const dateStr = fmt(day)
      const r = recordMap.get(dateStr)
      const isWe = isWeekend(day)

      const isVacRow = r?.location === 'DOVOLENÁ'
      const isSickRow = r?.is_sick ?? false

      const row = ws.addRow({
        datum: dateLabel(day),
        den: CZECH_DAYS[day.getDay()],
        od: r?.time_from?.slice(0, 5) ?? '',
        do_: r?.time_to?.slice(0, 5) ?? '',
        prestav: r !== undefined ? r.break_minutes : null,
        odprac: r ? Number(r.hours_worked) : null,
        presac: r ? effectiveOvertime(r) : null,
        misto: isVacRow ? 'DOVOLENÁ' : (r?.location ?? ''),
        zapis: r?.submitted_at ? new Date(r.submitted_at).toLocaleString('cs-CZ') : '',
        typ: isWe ? 'Víkend' : isVacRow ? 'Dovolená' : isSickRow ? 'Nemocenská' : 'Pracovní den',
      })

      if (isVacRow) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } }
        row.font = { bold: true, color: { argb: 'FF7D4E00' } }
      } else if (isSickRow) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0CCFF' } }
        row.font = { bold: true, color: { argb: 'FF5B2E9E' } }
      } else if (isWe) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
        row.font = { color: { argb: 'FF777777' } }
      } else if (!r) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
      }

      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      })
    })

    // Převod z minulého měsíce — vždy uveden (i s hodnotou 0), před řádkem CELKEM
    ws.addRow({})
    const carryRow = ws.addRow({
      datum: `Převedeno z ${CZECH_MONTHS[prevMonth.month - 1]} ${prevMonth.year}`,
      presac: carriedIn,
    })
    ws.mergeCells(`A${carryRow.number}:F${carryRow.number}`)
    carryRow.font = { bold: true }

    // Řádek CELKEM — u "Proplatit" skutečný přesčas za měsíc, u "Převést" kolik ještě zbývá dorovnat po převodu (0 pokud kredit pokryl schodek)
    const remainingDeficit = mode === 'carry' ? Math.min(totalBalance, 0) : totalOvertime
    const totalRow = ws.addRow({
      datum: 'CELKEM',
      den: '',
      od: '',
      do_: '',
      prestav: null,
      odprac: totalHours,
      presac: remainingDeficit,
      misto: employee.name,
      zapis: `${CZECH_MONTHS[month - 1]} ${year}`,
      typ: '',
    })
    totalRow.font = { bold: true, size: 12 }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8CCE4' } }
    totalRow.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF4472C4' } },
        left: { style: 'thin' },
        bottom: { style: 'medium', color: { argb: 'FF4472C4' } },
        right: { style: 'thin' },
      }
    })

    // Zůstatek — kredit přenášený do dalšího měsíce; u "Proplatit" se nic nepřevádí (0), u "Převést" kladná část zůstatku
    const remainingCredit = mode === 'carry' ? Math.max(totalBalance, 0) : 0
    const balanceRow = ws.addRow({
      datum: 'Zůstatek přesčasu na konci měsíce (po převodu)',
      presac: remainingCredit,
    })
    ws.mergeCells(`A${balanceRow.number}:F${balanceRow.number}`)
    balanceRow.font = { bold: true, size: 12 }
    balanceRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } }
    balanceRow.getCell('presac').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } }

    await downloadWorkbook(wb)
  }

  async function handleNoteSave() {
    if (noteText === note) return
    setNoteSaving(true)
    setNoteError(null)
    const result = await saveMonthNote(employeeId, year, month, noteText)
    setNoteSaving(false)
    if (result && 'error' in result) {
      setNoteError(`Poznámku se nepodařilo uložit: ${result.error}`)
      return
    }
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      {editDay && (
        <AttendanceEditModal
          employeeId={employeeId}
          date={editDay.date}
          dateLabel={editDay.dateLabel}
          record={editDay.record}
          workMode={workMode}
          onClose={() => setEditDay(null)}
        />
      )}

      {/* Navigace měsíce */}
      <div className="flex items-center justify-between bg-white rounded-xl border px-4 py-3">
        <button
          onClick={() => router.push(`/admin/dochazka/${employeeId}?year=${prevMonth.year}&month=${prevMonth.month}`)}
          className="text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{CZECH_MONTHS[month - 1]} {year}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isHourly ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
            {WORK_MODE_LABELS[workMode]}
          </span>
        </div>
        <button
          onClick={() => router.push(`/admin/dochazka/${employeeId}?year=${nextMonth.year}&month=${nextMonth.month}`)}
          className="text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
        >
          →
        </button>
      </div>

      {/* Souhrn */}
      <div className={`grid gap-3 ${isHourly ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">{isHourly ? 'Odpracované dny' : 'Záznamy'}</p>
          <p className="text-2xl font-bold">{records.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Odpracováno</p>
          <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
        </div>
        {!isHourly && (
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Přesčas</p>
            <p className={`text-2xl font-bold ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmtOvertime(totalOvertime)}h
            </p>
          </div>
        )}
      </div>

      {/* Export + Vyplnit měsíc */}
      <div className="flex items-center justify-end gap-3">
        {fillStatus && <span className="text-sm text-gray-500">{fillStatus}</span>}
        {!isHourly && (
          <button
            onClick={handleFillMonth}
            className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            Vyplnit pracovní dny
          </button>
        )}
        <button
          onClick={handleExport}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          ↓ Stáhnout Excel
        </button>
      </div>

      {/* Tabulka — desktop */}
      <div className="bg-white rounded-xl border overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Datum</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Den</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Od</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Do</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Přestávka</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Odprac.</th>
              {!isHourly && <th className="text-left px-3 py-2 font-medium text-gray-600">Přesčas</th>}
              <th className="text-left px-3 py-2 font-medium text-gray-600">Místo</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Čas zápisu</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {days.map(day => {
              const dateStr = fmt(day)
              const record = recordMap.get(dateStr)
              const isWe = isWeekend(day)
              const isHol = !isHourly && isHoliday(dateStr, holidays)
              const isVac = !isHourly && record?.location === 'DOVOLENÁ'
              const isSick = !isHourly && (record?.is_sick ?? false)
              const effOt = record ? effectiveOvertime(record) : 0
              // U Hodináře nemá nezapsaný den význam — nezvýrazňuje se žlutě
              const missing = !record && !isHourly
              return (
                <tr
                  key={dateStr}
                  className={`${isWe || isHol ? 'bg-gray-50 text-gray-400' : isVac ? 'bg-orange-50' : isSick ? 'bg-purple-50' : missing ? 'bg-yellow-50' : ''}`}
                >
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {dateLabel(day)}{isHol && !isWe ? ' 🗓' : ''}
                  </td>
                  <td className="px-3 py-2">{CZECH_DAYS[day.getDay()]}</td>
                  <td className="px-3 py-2">{record?.time_from?.slice(0, 5) ?? '—'}</td>
                  <td className="px-3 py-2">{record?.time_to?.slice(0, 5) ?? '—'}</td>
                  <td className="px-3 py-2">{record ? `${record.break_minutes} min` : '—'}</td>
                  <td className="px-3 py-2">{record ? `${Number(record.hours_worked).toFixed(2)}h` : '—'}</td>
                  {!isHourly && (
                    <td className={`px-3 py-2 font-medium ${record ? (effOt >= 0 ? 'text-green-600' : 'text-red-500') : ''}`}>
                      {record ? `${fmtOvertime(effOt)}h` : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-gray-500 max-w-32 truncate">
                    {isVac
                      ? <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Dovolená</span>
                      : isSick
                      ? <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">Nemocenská{record?.location ? ` · ${record.location}` : ''}</span>
                      : (record?.location ?? '—')
                    }
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                    {record?.submitted_at
                      ? new Date(record.submitted_at).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditDay({ date: dateStr, dateLabel: dateLabel(day), record: record ?? null })}
                      className={`text-xs px-2 py-1 rounded whitespace-nowrap transition-colors ${
                        record
                          ? 'text-blue-600 hover:bg-blue-50'
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {record ? 'Upravit' : '+ Přidat'}
                    </button>
                  </td>
                </tr>
              )
            })}
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              <td className="px-3 py-2" colSpan={5}>Celkem</td>
              <td className="px-3 py-2">{totalHours.toFixed(2)}h</td>
              {!isHourly && (
                <td className={`px-3 py-2 ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {fmtOvertime(totalOvertime)}h
                </td>
              )}
              <td className="px-3 py-2" colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Karty — mobil */}
      <div className="md:hidden space-y-2">
        {days.map(day => {
          const dateStr = fmt(day)
          const record = recordMap.get(dateStr)
          const isWe = isWeekend(day)
          const isHol = !isHourly && isHoliday(dateStr, holidays)
          const isVac = !isHourly && record?.location === 'DOVOLENÁ'
          const isSick = !isHourly && (record?.is_sick ?? false)
          const effOt = record ? effectiveOvertime(record) : 0

          // U Hodináře je nezapsaný den zcela běžný — žádné zvýraznění, ale i víkend
          // jde doplnit, protože pro něj neplatí pravidla kalendáře
          if (isHourly && !record) {
            return (
              <div key={dateStr} className={`rounded-lg border border-gray-100 px-4 py-2 flex justify-between items-center text-gray-400 text-sm ${isWe ? 'bg-gray-50' : 'bg-white'}`}>
                <span>{dateLabel(day)} {CZECH_DAYS[day.getDay()]}</span>
                <button
                  onClick={() => setEditDay({ date: dateStr, dateLabel: dateLabel(day), record: null })}
                  className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                >
                  + Přidat
                </button>
              </div>
            )
          }

          if ((isWe || isHol) && !record) {
            return (
              <div key={dateStr} className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-2 flex justify-between text-gray-400 text-sm">
                <span>{dateLabel(day)} {CZECH_DAYS[day.getDay()]}</span>
                <span>{isHol && !isWe ? 'Svátek' : 'Víkend'}</span>
              </div>
            )
          }

          return (
            <div key={dateStr} className={`rounded-lg border px-4 py-3 ${isVac ? 'bg-orange-50 border-orange-200' : isSick ? 'bg-purple-50 border-purple-200' : !record && !isWe && !isHol ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">
                    {dateLabel(day)} <span className="text-gray-400">{CZECH_DAYS[day.getDay()]}</span>
                    {isHol && !isWe && <span className="text-xs text-orange-500 ml-1">svátek</span>}
                  </p>
                  {record ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {record.time_from?.slice(0, 5)} – {record.time_to?.slice(0, 5)} · {record.break_minutes} min přestávka
                    </p>
                  ) : (
                    !isHourly && <p className="text-xs text-orange-400 mt-0.5">Nezapsáno</p>
                  )}
                  {isVac
                    ? <span className="inline-block text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded mt-0.5">Dovolená</span>
                    : isSick
                    ? <span className="inline-block text-xs font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded mt-0.5">Nemocenská{record?.location ? ` · ${record.location}` : ''}</span>
                    : record?.location && <p className="text-xs text-gray-400 mt-0.5">{record.location}</p>
                  }
                </div>
                <div className="flex items-center gap-3">
                  {record && (
                    <div className="text-right">
                      <p className="text-sm font-medium">{Number(record.hours_worked).toFixed(2)}h</p>
                      {!isHourly && (
                        <p className={`text-xs font-medium ${effOt >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmtOvertime(effOt)}h
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setEditDay({ date: dateStr, dateLabel: dateLabel(day), record: record ?? null })}
                    className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    {record ? 'Upravit' : '+ Přidat'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        <div className="bg-gray-100 rounded-lg border px-4 py-3 flex justify-between font-semibold text-sm">
          <span>Celkem</span>
          <div className="text-right">
            <p>{totalHours.toFixed(2)}h</p>
            {!isHourly && (
              <p className={`text-xs ${totalOvertime >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtOvertime(totalOvertime)}h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pracovní režim — platí od zobrazeného měsíce dál */}
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Pracovní režim</span>
          <span className="text-xs text-gray-400">{CZECH_MONTHS[month - 1]} {year}</span>
        </div>
        <WorkModeSwitch
          employeeId={employeeId}
          year={year}
          month={month}
          mode={workMode}
        />
        <p className="text-xs text-gray-400">
          {isHourly
            ? 'Hodinář — počítají se jen odpracované hodiny. Žádná povinná denní doba, přesčasy ani převody.'
            : 'Zaměstnanec — 8 h/den, přesčasy, víkendy a svátky, dovolená i nemocenská.'}
        </p>
      </div>

      {/* Přesčasy — převod (jen režim Zaměstnanec) */}
      {!isHourly && (
      <div className="bg-white rounded-xl border p-4 space-y-3">
        {carriedIn !== 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Převedeno z {CZECH_MONTHS[prevMonth.month - 1]}</span>
            <span className={`font-semibold px-2 py-0.5 rounded ${carriedIn >= 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
              {fmtOvertime(carriedIn)}h
            </span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Zbývá na konci měsíce</span>
          <span className={`font-semibold px-2 py-0.5 rounded ${totalBalance >= 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
            {fmtOvertime(totalBalance)}h
          </span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t">
          <span className="text-sm text-gray-500 mr-1">Přesčasy:</span>
          <button
            onClick={() => handleModeChange('pay')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'pay' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Proplatit
          </button>
          <button
            onClick={() => handleModeChange('carry')}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'carry' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Převést do {CZECH_MONTHS[nextMonth.month - 1]}
          </button>
          {isPending && <span className="text-xs text-gray-400">Ukládám...</span>}
          {modeError && <span className="text-xs text-red-600">{modeError}</span>}
        </div>
        <p className="text-xs text-gray-400">
          Nastavení platí od {CZECH_MONTHS[month - 1]} {year} dál — na konci měsíce se už nemusí nic potvrzovat.
          Zůstatek se počítá průběžně z docházky, takže pozdější oprava staršího měsíce se propíše i do dalších měsíců.
        </p>
      </div>
      )}

      {/* Poznámka k měsíci */}
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Poznámka</span>
          {noteSaving && <span className="text-xs text-gray-400">Ukládám...</span>}
          {noteSaved && <span className="text-xs text-green-600">Uloženo</span>}
          {noteError && <span className="text-xs text-red-600">{noteError}</span>}
        </div>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onBlur={handleNoteSave}
          rows={4}
          placeholder="Sem si můžete psát poznámky k tomuto měsíci..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  )
}
