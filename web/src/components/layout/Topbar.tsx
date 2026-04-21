'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

export function Topbar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()
  const [displayName, setDisplayName] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()

    setDisplayName(profile?.display_name || user.email?.split('@')[0] || t('common.operator'))
  }, [supabase, t])

  useEffect(() => {
    const frame = setTimeout(() => {
      void loadUser()
    }, 0)

    return () => clearTimeout(frame)
  }, [loadUser])

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const section =
    pathname?.startsWith('/portfolio')
      ? t('shared.sections.portfolio')
      : pathname?.startsWith('/history')
        ? t('shared.sections.history')
        : pathname?.startsWith('/alerts')
          ? t('shared.sections.alerts')
          : pathname?.startsWith('/dashboard')
            ? t('shared.sections.dashboard')
            : t('shared.sections.terminal')

  const initial = (displayName || t('common.operator')).trim().charAt(0).toUpperCase()

  return (
    <header className="topbar">
      <div className="flex items-center gap-4 min-w-0">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-obsidian-outline uppercase whitespace-nowrap">
          {t('shared.topbarLabel')}
        </div>
        <div className="h-3 w-px bg-obsidian-outline-var/60" />
        <div className="font-display text-[0.72rem] font-semibold tracking-[0.18em] text-obsidian-on uppercase whitespace-nowrap">
          {section}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <LanguageToggle compact />

        <div className="flex items-center gap-2 bg-obsidian-low border border-obsidian-outline-var px-3 py-1.5">
          <div className="w-5 h-5 bg-primary grid place-items-center font-mono text-[0.6rem] font-bold text-obsidian-bg">
            {initial}
          </div>
          <div className="text-[0.7rem] text-obsidian-on-var font-mono max-w-[180px] truncate">
            {displayName || t('common.operator')}
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="font-mono text-[0.62rem] tracking-widest uppercase px-3 py-1.5 border border-danger/40 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loggingOut ? t('common.loggingOut') : t('common.logout')}
        </button>
      </div>
    </header>
  )
}
