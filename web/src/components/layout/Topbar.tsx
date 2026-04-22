'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function Topbar() {
  const supabase = createClient()
  const router = useRouter()
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

  const initial = displayName ? displayName.charAt(0).toUpperCase() : '·'

  return (
    <div className="topbar font-mono justify-between">
      <div className="flex items-center gap-3">
        <span className="text-[10px] tracking-[0.2em] text-obsidian-on-var">
          CLIMATE RISK TERMINAL
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 border border-obsidian-outline-var bg-obsidian-low px-3 py-1.5 text-[11px] text-obsidian-on-var">
          <div className="flex h-5 w-5 items-center justify-center bg-primary text-[10px] font-bold text-obsidian-bg">
            {initial}
          </div>
          <span>{displayName || '—'}</span>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="border border-obsidian-outline-var px-3 py-1.5 text-[10px] tracking-[0.15em] text-obsidian-on-var transition-colors hover:border-danger/60 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut ? '...' : 'LOGOUT'}
        </button>
      </div>
    </div>
  )
}
