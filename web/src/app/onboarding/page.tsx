'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [linked, setLinked] = useState(false)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    initUser()
  }, [])

  async function initUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', user.id)
      .single()

    if (profile?.telegram_chat_id) {
      router.push('/dashboard')
      return
    }

    await generateCode(user.id)
  }

  const generateCode = useCallback(async (uid: string) => {
    setGenerating(true)
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    const code = Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join('')

    await supabase.from('telegram_link_codes').delete().eq('user_id', uid).eq('used', false)
    const { error } = await supabase.from('telegram_link_codes').insert({ code, user_id: uid })

    if (!error) {
      setLinkCode(code)
      startPolling(uid)
    }
    setGenerating(false)
  }, [])

  function startPolling(uid: string) {
    setPolling(true)
    const interval = setInterval(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', uid)
        .single()

      if (profile?.telegram_chat_id) {
        clearInterval(interval)
        setLinked(true)
        setPolling(false)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    }, 3000)

    setTimeout(() => {
      clearInterval(interval)
      setPolling(false)
    }, 15 * 60 * 1000)
  }

  async function handleSkip() {
    router.push('/dashboard')
  }

  if (linked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian-bg font-mono text-center px-6">
        <div className="text-primary text-[10px] tracking-[0.32em] mb-3">
          TELEGRAM VINCULADO
        </div>
        <div className="text-obsidian-on-var text-[11px]">
          Redirigiendo al dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian-bg font-mono px-6 py-12">
      <header className="mb-10 text-center">
        <div className="text-primary text-[10px] tracking-[0.32em] mb-2">
          THE VELVETEEN PROJECT
        </div>
        <div className="font-display text-[20px] font-bold text-obsidian-on tracking-wide">
          Stochasto<span className="text-primary">Green</span>
        </div>
      </header>

      <div className="w-full max-w-[480px] border border-obsidian-outline-var bg-obsidian-low p-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex h-6 w-6 items-center justify-center bg-primary text-[11px] font-bold text-obsidian-bg">
            ✓
          </div>
          <div className="flex-1 h-px bg-obsidian-outline-var" />
          <div className="flex h-6 w-6 items-center justify-center border border-primary text-[11px] font-bold text-primary">
            2
          </div>
        </div>

        <div className="text-primary text-[10px] tracking-[0.24em] mb-2">
          PASO 2 DE 2
        </div>
        <div className="text-obsidian-on text-[18px] font-bold mb-2">
          Vincula Telegram
        </div>
        <p className="text-obsidian-on-var text-[12px] leading-relaxed mb-8">
          Telegram es la interfaz principal de StochastoGreen. El bot construye tu portafolio,
          ejecuta los análisis y envía alertas de riesgo directamente en el chat.
        </p>

        {generating ? (
          <div className="text-obsidian-outline text-[12px] text-center py-6">
            Generando código...
          </div>
        ) : linkCode ? (
          <>
            <div className="mb-6">
              <div className="text-obsidian-outline text-[10px] tracking-[0.2em] mb-3">
                PASO 1 · ABRE EL BOT
              </div>
              <a
                href="https://t.me/velveteen_stochasto_green_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-obsidian-bg border border-obsidian-outline-var text-obsidian-on-var px-5 py-3.5 text-[13px] font-bold tracking-wide text-center no-underline hover:border-primary/60 hover:text-primary transition-colors"
              >
                → @velveteen_stochasto_green_bot
              </a>
            </div>

            <div className="mb-6">
              <div className="text-obsidian-outline text-[10px] tracking-[0.2em] mb-3">
                PASO 2 · ENVÍA ESTE COMANDO
              </div>
              <div className="bg-obsidian-bg border border-obsidian-outline-var px-5 py-4 flex items-center justify-between">
                <span className="text-primary text-[16px] font-bold tracking-[0.2em]">
                  /link {linkCode}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(`/link ${linkCode}`)}
                  className="bg-transparent border border-obsidian-outline-var text-obsidian-on-var px-2.5 py-1 text-[10px] cursor-pointer hover:text-primary hover:border-primary/60 transition-colors"
                >
                  COPIAR
                </button>
              </div>
              <div className="text-obsidian-outline text-[10px] mt-2">
                Válido por 15 minutos
              </div>
            </div>

            <div className="border border-obsidian-outline-var bg-obsidian-bg px-4 py-3 flex items-center gap-2.5 mb-6">
              <div
                className={`h-2 w-2 rounded-full ${polling ? 'bg-success animate-pulse' : 'bg-obsidian-outline'}`}
              />
              <span className={`text-[11px] ${polling ? 'text-success' : 'text-obsidian-outline'}`}>
                {polling ? 'Esperando confirmación del bot...' : 'Listo para vincular'}
              </span>
            </div>

            <button
              onClick={() => userId && generateCode(userId)}
              className="bg-transparent border-none text-obsidian-outline text-[11px] cursor-pointer underline block mb-3 hover:text-obsidian-on-var transition-colors"
            >
              Generar nuevo código
            </button>
          </>
        ) : null}

        <button
          onClick={handleSkip}
          className="bg-transparent border-none text-obsidian-outline text-[11px] cursor-pointer block mt-2 hover:text-obsidian-on-var transition-colors"
        >
          Saltar por ahora →
        </button>
      </div>
    </div>
  )
}
