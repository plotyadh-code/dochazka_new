// Ověření oprávnění na serveru
//
// Ochrana ve stránce (admin/layout.tsx, proxy.ts) hlídá jen navigaci — server
// action jde zavolat i bez otevření stránky. Každá akce, která mění cizí data,
// si proto musí roli ověřit sama.

import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type AuthOk = { supabase: SupabaseServerClient; userId: string }
type AuthError = { error: string }

/** Přihlášený uživatel, nebo chyba. */
export async function requireUser(): Promise<AuthOk | AuthError> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nejste přihlášeni.' }
  return { supabase, userId: user.id }
}

/** Přihlášený uživatel s rolí admin, nebo chyba. */
export async function requireAdmin(): Promise<AuthOk | AuthError> {
  const auth = await requireUser()
  if ('error' in auth) return auth

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.userId)
    .single()

  if (profile?.role !== 'admin') return { error: 'Nemáte oprávnění k této akci.' }
  return auth
}
