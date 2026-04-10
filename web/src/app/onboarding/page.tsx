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
  }

  const generateCode = useCallback(async (uid: string) => {
    setGenerating(true)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Eliminar codigos anteriores no usados de este usuario
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
  }

  async function handleSkip() {
    // Permitir saltar onboarding - pueden vincular despues en Alertas
    // Pero marcamos un telegram_chat_id placeholder para no quedar en loop
    // En su lugar, simplemente quitamos /onboarding de las rutas bloqueadas
    // y dejamos pasar. Aqui solo navegamos al dashboard.
    router.push('/dashboard')
  }

  const s = {
    page: {
      minHeight: '100vh',
      background: '#131315',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      padding: '24px',
    },
    card: {
      width: '100%',
      maxWidth: '480px',
      border: '1px solid #222',
      background: '#0d0d0f',
      padding: '40px',
    },
  }

  if (linked) {
    return (
      <div style={s.page}>
        <div
          style={{
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <div
            style={{ color: '#57f1db', fontSize: '16px', fontWeight: '700', letterSpacing: '2px', marginBottom: '8px' }}
          >
            ¡TELEGRAM VINCULADO!
          </div>
          <div style={{ color: '#555', fontSize: '12px' }}>Redirigiendo al dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{ color: '#f5c347', fontSize: '11px', letterSpacing: '4px', marginBottom: '8px' }}>
          THE VELVETEEN PROJECT
        </div>
        <div style={{ color: '#57f1db', fontSize: '20px', fontWeight: '700', letterSpacing: '2px' }}>
          STOCHASTO_GREEN
        </div>
      </div>

      <div style={s.card}>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              background: '#57f1db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: '#0d0d0f',
              fontWeight: '700',
            }}
          >
            ✓
          </div>
          <div style={{ flex: 1, height: '1px', background: '#2a2a2a' }} />
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '1px solid #57f1db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: '#57f1db',
              fontWeight: '700',
            }}
          >
            2
          </div>
          <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '1px solid #333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: '#444',
            }}
          >
            3
          </div>
        </div>

        <div style={{ color: '#57f1db', fontSize: '11px', letterSpacing: '3px', marginBottom: '8px' }}>PASO 2 DE 3</div>
        <div style={{ color: '#e0e0e0', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Vincula Telegram</div>
        <p style={{ color: '#666', fontSize: '12px', lineHeight: '1.8', marginBottom: '32px' }}>
          Telegram es la interfaz principal de StochastoGreen. El bot construira tu portafolio, ejecutara los analisis y
          te enviara alertas de riesgo directamente en el chat.
        </p>

        {generating ? (
          <div style={{ color: '#444', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Generando codigo...</div>
        ) : linkCode ? (
          <>
            {/* Paso 1 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: '#555', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
                PASO 1 - ABRE EL BOT
              </div>
              <a
                href='https://t.me/velveteen_stochasto_green_bot'
                target='_blank'
                rel='noopener noreferrer'
                style={{
                  display: 'block',
                  background: '#0a1a2a',
                  border: '1px solid #1a3a5a',
                  color: '#57f1db',
                  padding: '14px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '1px',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                → @velveteen_stochasto_green_bot
              </a>
            </div>

            {/* Paso 2 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: '#555', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
                PASO 2 - ENVIA ESTE COMANDO
              </div>
              <div
                style={{
                  background: '#0d0d0f',
                  border: '1px solid #2a2a2a',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: '#f5c347', fontSize: '16px', fontWeight: '700', letterSpacing: '3px' }}>
                  /link {linkCode}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(`/link ${linkCode}`)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #333',
                    color: '#555',
                    padding: '4px 10px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  COPIAR
                </button>
              </div>
              <div style={{ color: '#333', fontSize: '10px', marginTop: '8px' }}>⏱ Valido por 15 minutos</div>
            </div>

            {/* Status */}
            <div
              style={{
                background: '#0a1a0a',
                border: '1px solid #1a2a1a',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  background: polling ? '#4ade80' : '#444',
                  borderRadius: '50%',
                  animation: polling ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span style={{ color: polling ? '#4ade80' : '#444', fontSize: '11px' }}>
                {polling ? 'Esperando confirmacion del bot...' : 'Listo para vincular'}
              </span>
            </div>

            {/* Regenerar */}
            <button
              onClick={() => userId && generateCode(userId)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#444',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                textDecoration: 'underline',
                marginBottom: '12px',
                display: 'block',
              }}
            >
              Generar nuevo codigo
            </button>
          </>
        ) : null}

        {/* Skip */}
        <button
          onClick={handleSkip}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#333',
            fontSize: '11px',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'block',
            marginTop: '8px',
          }}
        >
          Saltar por ahora →
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
