'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function Topbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [displayName, setDisplayName] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()

    setDisplayName(profile?.display_name || user.email?.split('@')[0] || 'Operador')
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const section =
    pathname?.startsWith('/portfolio')
      ? 'PORTAFOLIO'
      : pathname?.startsWith('/history')
        ? 'HISTORIAL'
        : pathname?.startsWith('/alerts')
          ? 'ALERTAS'
          : pathname?.startsWith('/dashboard')
            ? 'DASHBOARD'
            : 'TERMINAL'

  const initial = (displayName || 'Operador').trim().charAt(0).toUpperCase()

  return (
    <header className="topbar">
      <div className="flex items-center gap-4 min-w-0">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-obsidian-outline uppercase whitespace-nowrap">
          // Climate Risk Terminal
        </div>
        <div className="h-3 w-px bg-obsidian-outline-var/60" />
        <div className="font-display text-[0.72rem] font-semibold tracking-[0.18em] text-obsidian-on uppercase whitespace-nowrap">
          {section}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 bg-obsidian-low border border-obsidian-outline-var px-3 py-1.5">
          <div className="w-5 h-5 bg-primary grid place-items-center font-mono text-[0.6rem] font-bold text-obsidian-bg">
            {initial}
          </div>
          <div className="text-[0.7rem] text-obsidian-on-var font-mono max-w-[180px] truncate">
            {displayName || 'Operador'}
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="font-mono text-[0.62rem] tracking-widest uppercase px-3 py-1.5 border border-danger/40 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loggingOut ? 'Saliendo...' : 'Salir'}
        </button>
      </div>
    </header>
  )
}
