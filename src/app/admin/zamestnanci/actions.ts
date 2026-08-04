'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WorkMode } from '@/lib/workMode'

export async function createEmployee(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    return { error: 'Vyplňte všechna pole' }
  }

  const supabase = createAdminClient()

  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name, role: 'employee' },
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      return { error: 'Tento e-mail je již registrován' }
    }
    return { error: 'Chyba při vytváření zaměstnance: ' + error.message }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUser.user.id,
    name,
    email,
    role: 'employee',
    initial_password: password,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(newUser.user.id)
    return { error: 'Chyba při vytváření profilu: ' + profileError.message }
  }

  revalidatePath('/admin/zamestnanci')
  return { success: true }
}

/**
 * Nastaví pracovní režim zaměstnance od zadaného měsíce dál.
 * Starší měsíce zůstávají beze změny — drží si režim, který u nich platil.
 */
export async function setWorkMode(
  employeeId: string,
  year: number,
  month: number,
  mode: WorkMode
) {
  if (!employeeId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { error: 'Neplatný měsíc' }
  }
  if (mode !== 'employee' && mode !== 'hourly') {
    return { error: 'Neplatný režim' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('employee_work_modes')
    .upsert(
      { employee_id: employeeId, year, month, mode, updated_at: new Date().toISOString() },
      { onConflict: 'employee_id,year,month' }
    )

  if (error) return { error: error.message }

  revalidatePath('/admin/zamestnanci')
  revalidatePath(`/admin/dochazka/${employeeId}`)
  revalidatePath('/dochazka')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return { error: error.message }
  revalidatePath('/admin/zamestnanci')
  return { success: true }
}
