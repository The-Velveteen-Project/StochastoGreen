import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated session
const PROTECTED_ROUTES = ['/dashboard', '/portfolio', '/history', '/alerts']
const AUTH_ROUTES      = ['/login', '/register']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()        { return request.cookies.getAll() },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── Optimistic session check ──────────────────────────────────────────────
  // getSession() reads the JWT from the cookie — zero network calls.
  // Next.js 16 Proxy must not do slow data fetching (Edge Runtime limit).
  // Full auth validation + Telegram-link check happens in dashboard/layout.tsx
  // (Server Component, no Edge restrictions).
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isProtected  = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAuthRoute  = AUTH_ROUTES.some(r => pathname.startsWith(r))

  if (!session && (isProtected || pathname === '/onboarding')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (session && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
