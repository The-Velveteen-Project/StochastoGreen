'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AlertsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkTelegramStatus()
  }, [])

  async function checkTelegramStatus() {
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
      .select('telegram_chat_id, telegram_linked_at')
      .eq('id', user.id)
      .single()

    setTelegramLinked(!!profile?.telegram_chat_id)
    setLoading(false)
  }

  async function generateLinkCode() {
    if (!userId) return
    setGeneratingCode(true)

    // Generar codigo aleatorio de 6 caracteres
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { error } = await supabase.from('telegram_link_codes').insert({ code, user_id: userId })

    if (!error) {
      setLinkCode(code)
    }
    setGeneratingCode(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', fontFamily: "'JetBrains Mono', monospace", color: '#444' }}>Cargando...</div>
    )
  }

  return (
    <div style={{ padding: '32px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ color: '#f5c347', fontSize: '10px', letterSpacing: '3px', marginBottom: '4px' }}>
        SISTEMA DE ALERTAS
      </div>
      <h1 style={{ color: '#e0e0e0', fontSize: '20px', fontWeight: '700', marginBottom: '32px' }}>
        Alertas y Notificaciones
      </h1>

      {/* Telegram Link Card */}
      <div
        style={{
          border: `1px solid ${telegramLinked ? '#1a3a2a' : '#2a2a1a'}`,
          background: telegramLinked ? '#0d1a12' : '#141208',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '24px' }}>{telegramLinked ? '✅' : '🔗'}</span>
          <div>
            <div style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: '700' }}>Telegram</div>
            <div style={{ color: telegramLinked ? '#4ade80' : '#f5c347', fontSize: '10px', letterSpacing: '2px' }}>
              {telegramLinked ? 'VINCULADO' : 'SIN VINCULAR'}
            </div>
          </div>
        </div>

        {telegramLinked ? (
          <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>
            Tu cuenta está vinculada. Los análisis del bot se guardarán automáticamente y recibirás alertas en Telegram
            cuando el riesgo de tus activos supere los umbrales definidos.
          </p>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '20px' }}>
              Vincula tu cuenta para recibir alertas automáticas y sincronizar los análisis del bot con el dashboard.
            </p>

            {!linkCode ? (
              <button
                onClick={generateLinkCode}
                disabled={generatingCode}
                style={{
                  background: generatingCode ? '#1a1a1a' : '#f5c347',
                  color: '#0d0d0f',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '2px',
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: generatingCode ? 'not-allowed' : 'pointer',
                }}
              >
                {generatingCode ? 'GENERANDO...' : 'GENERAR CÓDIGO DE VINCULACIÓN'}
              </button>
            ) : (
              <div>
                <div style={{ color: '#555', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>
                  TU CÓDIGO (válido 15 minutos):
                </div>
                <div
                  style={{
                    background: '#0d0d0f',
                    border: '1px solid #57f1db',
                    padding: '16px 24px',
                    display: 'inline-block',
                    color: '#57f1db',
                    fontSize: '28px',
                    fontWeight: '700',
                    letterSpacing: '8px',
                    marginBottom: '16px',
                  }}
                >
                  {linkCode}
                </div>
                <div style={{ color: '#666', fontSize: '11px' }}>
                  Abre el bot en Telegram:{' '}
                  <a
                    href='https://t.me/velveteen_stochasto_green_bot'
                    target='_blank'
                    style={{ color: '#57f1db', textDecoration: 'none' }}
                  >
                    @velveteen_stochasto_green_bot
                  </a>{' '}
                  y envía: <span style={{ color: '#f5c347' }}>/link {linkCode}</span>
                </div>
                <button
                  onClick={() => {
                    setLinkCode(null)
                    checkTelegramStatus()
                  }}
                  style={{
                    marginTop: '16px',
                    background: 'transparent',
                    border: '1px solid #333',
                    color: '#666',
                    padding: '8px 16px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '1px',
                  }}
                >
                  YA LO HICE — VERIFICAR
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Alertas placeholder */}
      <div
        style={{
          border: '1px solid #1a1a1c',
          padding: '48px',
          textAlign: 'center',
          color: '#444',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔔</div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px' }}>Sistema de alertas - proximamente</div>
        <div style={{ fontSize: '11px', color: '#333' }}>
          Configura umbrales de CVaR por activo y recibe notificaciones automáticas en Telegram cuando el riesgo supere
          el límite.
        </div>
      </div>
    </div>
  )
}
