import type { WorkMode } from '@/lib/workMode'

export type Profile = {
  id: string
  name: string
  email?: string
  role: 'admin' | 'employee'
  initial_password?: string
  /** false = bývalý zaměstnanec (nepřihlásí se, docházka zůstává k náhledu) */
  is_active?: boolean
  created_at: string
}

export type AttendanceRecord = {
  id: number
  employee_id: string
  date: string
  time_from: string
  time_to: string
  break_minutes: 0 | 30 | 60
  location: string | null
  is_sick: boolean
  hours_worked: number
  overtime: number
  submitted_at: string
  created_at: string
}

export type WorkModeRow = {
  employee_id: string
  year: number
  month: number
  mode: WorkMode
}

export type HourlyAction = {
  id: number
  employee_id: string
  year: number
  month: number
  description: string
  amount: number
  created_at: string
}
