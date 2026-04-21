import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated session
const PROTECTED_ROUTES = ['/dashboard', '/portfolio', '/history', '/alerts']
const AUTH_ROUTES      = ['/login', '/register']

export function proxy(request: NextRequest) {
  // ── Optimistic session check — ZERO network calls ─────────────────────────
  // We inspect the Supabase auth cookie directly instead of calling
  // supabase.auth.getSession().  getSession() auto-refreshes expired tokens,
  // which requires a round-trip to Supabase Auth — in the proxy that round-trip
  // blocks the entire request pipeline and produces "This page couldn't load"
  // after ~5 s whenever the access token has expired (every 60 min by default).
  //
  // A cookie-name check is sufficient here because:
  //   • It's purely optimistic — we only redirect obvious unauthenticated users.
  //   • Full JWT validation + Telegram-link check run in dashboard/layout.tsx
  //     (Server Component, Node.js runtime, no restrictions).
  const hasSession = request.cookies.getAll()
    .some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  const { pathname } = request.nextUrl
  const isProtected  = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAuthRoute  = AUTH_ROUTES.some(r => pathname.startsWith(r))

  if (!hasSession && (isProtected || pathname === '/onboarding')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
