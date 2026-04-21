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
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // getUser() validates the JWT against Supabase Auth — secure, not optimistic.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Telegram link check — required to access the dashboard.
  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', user.id)
    .single()

  if (!profile?.telegram_chat_id) redirect('/onboarding')

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
