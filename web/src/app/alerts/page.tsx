'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase'
import { useRouter }           from 'next/navigation'
import type { VerdictAction }  from '@/lib/supabase'

type AlertRow = {
  id:             string
  ticker:         string
  cvar_95:        number | null
  verdict_action: VerdictAction | null
  climate_beta:   number | null
  created_at:     string
  severity:       'CRÍTICA' | 'MEDIA' | 'BAJA'
}

function severity(cvar: number | null, action: VerdictAction | null): AlertRow['severity'] {
  if ((cvar != null && cvar > 20) || action === 'VENDER') return 'CRÍTICA'
  if ((cvar != null && cvar > 10) || action === 'MANTENER') return 'MEDIA'
  return 'BAJA'
}

const SEV_COLOR  = { 'CRÍTICA': '#ff6b6b', 'MEDIA': '#f5c347', 'BAJA': '#4ade80' }
const SEV_BG     = { 'CRÍTICA': '#1a0808', 'MEDIA': '#141208', 'BAJA': '#081408' }
const SEV_BORDER = { 'CRÍTICA': '#3a1010', 'MEDIA': '#2a2210', 'BAJA': '#102210' }

export default function AlertsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null)
  const [linkCode,       setLinkCode]       = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [userId,         setUserId]         = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [alerts,         setAlerts]         = useState<AlertRow[]>([])

  useEffect(() => { checkTelegramStatus() }, [])

  async function checkTelegramStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [{ data: profile }, { data: analyses }] = await Promise.all([
      supabase.from('profiles')
        .select('telegram_chat_id, telegram_linked_at')
        .eq('id', user.id)
        .single(),
      supabase.from('risk_analyses')
        .select('id, ticker, cvar_95, verdict_action, climate_beta, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setTelegramLinked(!!profile?.telegram_chat_id)

    const rows: AlertRow[] = (analyses ?? [])
      .map(r => ({
        ...r,
        verdict_action: r.verdict_action as VerdictAction | null,
        severity: severity(r.cvar_95, r.verdict_action as VerdictAction | null),
      }))
      .filter(r => r.severity !== 'BAJA')
      .sort((a, b) => ({ 'CRÍTICA': 0, 'MEDIA': 1, 'BAJA': 2 }[a.severity] - { 'CRÍTICA': 0, 'MEDIA': 1, 'BAJA': 2 }[b.severity]))

    setAlerts(rows)
    setLoading(false)
  }

  async function generateLinkCode() {
    if (!userId) return
    setGeneratingCode(true)

    // Código criptográficamente seguro — 6 chars alfanuméricos sin ambigüedad
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    const code  = Array.from(bytes).map(b => CHARS[b % CHARS.length]).join('')

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

      {/* Alertas reales */}
      <div style={{ color: '#f5c347', fontSize: '10px', letterSpacing: '3px', marginBottom: '16px' }}>
        ALERTAS DE RIESGO · CVaR &gt; 10% ó VENDER
      </div>

      {alerts.length === 0 ? (
        <div style={{ border: '1px solid #1a1a1c', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>✅</div>
          <div style={{ fontSize: '13px', color: '#4ade80', marginBottom: '8px' }}>Sin alertas activas</div>
          <div style={{ fontSize: '11px', color: '#444' }}>
            Todos los activos analizados tienen riesgo bajo (CVaR ≤ 10% y veredicto COMPRAR).
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alerts.map(a => {
            const col    = SEV_COLOR[a.severity]
            const bg     = SEV_BG[a.severity]
            const border = SEV_BORDER[a.severity]
            return (
              <div key={a.id} style={{ background: bg, border: `1px solid ${border}`, padding: '16px 20px', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: '20px' }}>
                {/* Severity pill */}
                <div style={{ color: col, border: `1px solid ${col}30`, padding: '2px 8px', fontSize: '9px', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  {a.severity}
                </div>
                {/* Ticker + meta */}
                <div>
                  <div style={{ color: '#57f1db', fontSize: '13px', fontWeight: '700', letterSpacing: '1px' }}>{a.ticker}</div>
                  <div style={{ color: '#444', fontSize: '10px', marginTop: '2px' }}>
                    {new Date(a.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    {a.climate_beta != null && <span style={{ marginLeft: '12px' }}>β={a.climate_beta.toFixed(1)}</span>}
                  </div>
                </div>
                {/* CVaR */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#555', fontSize: '9px', letterSpacing: '1px' }}>CVaR 95%</div>
                  <div style={{ color: col, fontSize: '14px', fontWeight: '700' }}>
                    {a.cvar_95 != null ? `${a.cvar_95.toFixed(1)}%` : '—'}
                  </div>
                </div>
                {/* Verdict badge */}
                <div>
                  {a.verdict_action ? (
                    <span style={{ color: col, border: `1px solid ${col}40`, padding: '3px 10px', fontSize: '10px', letterSpacing: '1px', fontWeight: '700' }}>
                      {a.verdict_action}
                    </span>
                  ) : <span style={{ color: '#444' }}>—</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
