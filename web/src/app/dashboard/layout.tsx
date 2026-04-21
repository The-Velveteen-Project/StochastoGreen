import { redirect }           from 'next/navigation'
import { createClient }        from '@/lib/supabase-server'
import { Sidebar }             from '@/components/layout/Sidebar'
import { Topbar }              from '@/components/layout/Topbar'

/**
 * Server Component — runs on the Node.js runtime (no Edge restrictions).
 * Performs the full auth + Telegram-link validation that was previously
 * in middleware.ts (now proxy.ts), where DB calls are forbidden.
 *
 * Guards the entire /dashboard/** subtree:
 *   - No session    → /login
 *   - No Telegram   → /onboarding
 *   - Supabase down → /login  (fail-safe: at least sends a response)
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // getUser() validates the JWT against Supabase Auth — secure, not optimistic.
  // Wrapped in try/catch so a Supabase outage redirects instead of hanging.
  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase Auth unreachable — treat as unauthenticated.
    redirect('/login')
  }
  if (!user) redirect('/login')

  // Telegram link check — required to access the dashboard.
  let telegramLinked = false
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', user.id)
      .single()
    telegramLinked = !!profile?.telegram_chat_id
  } catch {
    // DB unreachable — send to onboarding; they can retry from there.
    redirect('/onboarding')
  }
  if (!telegramLinked) redirect('/onboarding')

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
