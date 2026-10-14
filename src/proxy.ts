import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null }

  // Bývalý zaměstnanec — odhlásit (smazat session cookies) a zpět na přihlášení.
  // Přihlášení mu blokuje i ban v Supabase Auth, tohle řeší ještě platnou session.
  if (user && profile?.is_active === false) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) response.cookies.delete(name)
    })
    return response
  }

  if (user && pathname === '/login') {
    const target = profile?.role === 'admin' ? '/admin' : '/dochazka'
    return NextResponse.redirect(new URL(target, request.url))
  }

  if (pathname.startsWith('/admin') && user && profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dochazka', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
