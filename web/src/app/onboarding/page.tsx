'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AuthShell } from '@/components/layout/AuthShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const { dictionary } = useLanguage()
  const { onboarding, common } = dictionary
  const [userId, setUserId] = useState<string | null>(null)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [linked, setLinked] = useState(false)
  const [polling, setPolling] = useState(false)
  const [copied, setCopied] = useState(false)

  const startPolling = useCallback((uid: string) => {
    setPolling(true)
    // Polling cada 3 segundos para detectar vinculacion
    const interval = setInterval(async () => {
      const { data: profile } = await supabase.from('profiles').select('telegram_chat_id').eq('id', uid).single()

      if (profile?.telegram_chat_id) {
        clearInterval(interval)
        setLinked(true)
        setPolling(false)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    }, 3000)

    // Limpiar polling despues de 15 minutos (TTL del codigo)
    setTimeout(() => {
      clearInterval(interval)
      setPolling(false)
    }, 15 * 60 * 1000)
  }, [router, supabase])

  const generateCode = useCallback(async (uid: string) => {
    setGenerating(true)
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    const code  = Array.from(bytes).map(b => CHARS[b % CHARS.length]).join('')

    // Eliminar codigos anteriores no usados de este usuario
    await supabase.from('telegram_link_codes').delete().eq('user_id', uid).eq('used', false)

    const { error } = await supabase.from('telegram_link_codes').insert({ code, user_id: uid })

    if (!error) {
      setLinkCode(code)
      startPolling(uid)
    }
    setGenerating(false)
  }, [startPolling, supabase])

  const initUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    // Si ya tiene Telegram vinculado, pasar directo al dashboard
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', user.id)
      .single()

    if (profile?.telegram_chat_id) {
      router.push('/dashboard')
      return
    }

    // Auto-generar codigo al entrar
    await generateCode(user.id)
  }, [generateCode, router, supabase])

  useEffect(() => {
    const frame = setTimeout(() => {
      void initUser()
    }, 0)

    return () => clearTimeout(frame)
  }, [initUser])

  async function handleSkip() {
    // Permitir saltar onboarding - pueden vincular despues en Alertas
    // Pero marcamos un telegram_chat_id placeholder para no quedar en loop
    // En su lugar, simplemente quitamos /onboarding de las rutas bloqueadas
    // y dejamos pasar. Aqui solo navegamos al dashboard.
    router.push('/dashboard')
  }

  const telegramBotUrl = 'https://t.me/velveteen_stochasto_green_bot'

  if (linked) {
    return (
      <AuthShell subtitle={onboarding.subtitle} eyebrow={onboarding.successEyebrow}>
        <div className="space-y-3 text-center">
          <div className="font-display text-lg font-bold text-obsidian-on">{onboarding.successTitle}</div>
          <div className="font-mono text-[0.72rem] text-obsidian-on-var">{onboarding.successBody}</div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle={onboarding.subtitle} eyebrow={onboarding.eyebrow} maxWidthClassName="max-w-lg">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 grid place-items-center bg-success/15 border border-success/30 text-success font-mono text-[0.6rem] font-bold">
            1
          </div>
          <div className="h-px flex-1 bg-obsidian-outline-var/70" />
          <div className="w-6 h-6 grid place-items-center bg-primary/15 border border-primary/40 text-primary font-mono text-[0.6rem] font-bold">
            2
          </div>
          <div className="h-px flex-1 bg-obsidian-outline-var/40" />
          <div className="w-6 h-6 grid place-items-center bg-obsidian-mid border border-obsidian-outline-var text-obsidian-outline font-mono text-[0.6rem] font-bold">
            3
          </div>
        </div>

        <div>
          <div className="font-display text-lg font-bold text-obsidian-on">{onboarding.title}</div>
          <p className="mt-2 text-obsidian-on-var text-[0.85rem] leading-relaxed">
            {onboarding.description}
          </p>
        </div>

        {generating ? (
          <div className="text-center font-mono text-[0.75rem] text-obsidian-on-var py-6">{onboarding.generating}</div>
        ) : linkCode ? (
          <div className="space-y-5">
            <div>
              <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
                {onboarding.steps.openBot}
              </div>
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-obsidian-mid border border-obsidian-outline-var px-4 py-3 font-mono text-[0.75rem] text-secondary hover:bg-obsidian-high transition-colors text-center"
              >
                @velveteen_stochasto_green_bot
              </a>
            </div>

            <div>
              <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
                {onboarding.steps.sendCommand}
              </div>
              <div className="bg-obsidian-mid border border-obsidian-outline-var px-4 py-3 flex items-center justify-between gap-3">
                <div className="font-mono text-[0.95rem] font-bold tracking-widest text-primary">{`/link ${linkCode}`}</div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`/link ${linkCode}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="shrink-0 px-2.5 py-1 border border-obsidian-outline-var text-obsidian-on-var hover:text-obsidian-on hover:bg-obsidian-high transition-colors font-mono text-[0.6rem] tracking-widest uppercase"
                >
                  {copied ? common.copied : common.copy}
                </button>
              </div>
              <div className="mt-2 font-mono text-[0.58rem] tracking-widest text-obsidian-outline uppercase">
                {common.linkCodeValid}
              </div>
            </div>

            <div className="bg-success/5 border border-success/20 px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${polling ? 'bg-success animate-pulse' : 'bg-obsidian-outline'}`} />
              <div className={`font-mono text-[0.7rem] ${polling ? 'text-success' : 'text-obsidian-outline'}`}>
                {polling ? onboarding.waiting : onboarding.ready}
              </div>
            </div>

            <button
              type="button"
              onClick={() => userId && generateCode(userId)}
              className="font-mono text-[0.68rem] text-obsidian-on-var hover:text-obsidian-on transition-colors underline"
            >
              {onboarding.regenerate}
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="font-mono text-[0.75rem] text-obsidian-on-var">{onboarding.failed}</div>
            <button
              type="button"
              onClick={() => userId && generateCode(userId)}
              disabled={!userId}
              className="mt-4 px-4 py-2 border border-obsidian-outline-var text-obsidian-on hover:bg-obsidian-mid transition-colors font-mono text-[0.65rem] tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {common.retry}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="font-mono text-[0.68rem] text-obsidian-outline hover:text-obsidian-on-var transition-colors underline"
        >
          {onboarding.skip}
        </button>
      </div>
    </AuthShell>
  )
}
