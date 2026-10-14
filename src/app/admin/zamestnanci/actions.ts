'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { WorkMode } from '@/lib/workMode'

export async function createEmployee(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    return { error: 'Vyplňte všechna pole' }
  }

  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

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

  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const { error } = await auth.supabase
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

/**
 * Aktivní / bývalý zaměstnanec. Bývalému se zablokuje přihlášení (ban v Supabase
 * Auth), docházka zůstává. Funguje obousměrně — aktivace přihlášení zase povolí.
 */
export async function setEmployeeActive(employeeId: string, active: boolean) {
  if (!employeeId) return { error: 'Chybí zaměstnanec' }

  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', employeeId)
    .single()
  if (profile?.role !== 'employee') return { error: 'Lze nastavit jen u zaměstnance' }

  const { error: banError } = await supabase.auth.admin.updateUserById(employeeId, {
    ban_duration: active ? 'none' : '876000h',
  })
  if (banError) return { error: banError.message }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: active })
    .eq('id', employeeId)

  if (error) {
    // Vrátit přihlášení do původního stavu, ať profil a Auth nejsou v rozporu
    await supabase.auth.admin.updateUserById(employeeId, {
      ban_duration: active ? '876000h' : 'none',
    })
    return { error: error.message }
  }

  revalidatePath('/admin/zamestnanci')
  revalidatePath('/admin/dochazka')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return { error: error.message }
  revalidatePath('/admin/zamestnanci')
  return { success: true }
}
