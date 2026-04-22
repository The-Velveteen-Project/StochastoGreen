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

const SEV_TEXT   = { 'CRÍTICA': 'text-danger',  'MEDIA': 'text-warn',    'BAJA': 'text-success' }
const SEV_BORDER = { 'CRÍTICA': 'border-danger/30', 'MEDIA': 'border-warn/30', 'BAJA': 'border-success/30' }
const SEV_BG     = { 'CRÍTICA': 'bg-danger/5',  'MEDIA': 'bg-warn/5',    'BAJA': 'bg-success/5' }

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
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    const code  = Array.from(bytes).map(b => CHARS[b % CHARS.length]).join('')
    const { error } = await supabase.from('telegram_link_codes').insert({ code, user_id: userId })
    if (!error) setLinkCode(code)
    setGeneratingCode(false)
  }

  if (loading) {
    return (
      <div className="p-8 font-mono text-obsidian-outline text-[12px]">Cargando...</div>
    )
  }

  return (
    <div className="p-8 font-mono">
      <div className="text-primary text-[10px] tracking-[0.28em] mb-1">
        SISTEMA DE ALERTAS
      </div>
      <h1 className="text-obsidian-on text-[20px] font-bold mb-8">
        Alertas y Notificaciones
      </h1>

      {/* Telegram Link Card */}
      <div className={`border p-6 mb-6 ${telegramLinked ? 'border-success/30 bg-success/5' : 'border-obsidian-outline-var bg-obsidian-low'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`h-2.5 w-2.5 rounded-full ${telegramLinked ? 'bg-success animate-pulse' : 'bg-obsidian-outline'}`} />
          <div>
            <div className="text-obsidian-on text-[13px] font-bold">Telegram</div>
            <div className={`text-[10px] tracking-[0.2em] ${telegramLinked ? 'text-success' : 'text-warn'}`}>
              {telegramLinked ? 'VINCULADO' : 'SIN VINCULAR'}
            </div>
          </div>
        </div>

        {telegramLinked ? (
          <p className="text-obsidian-on-var text-[12px] m-0">
            Tu cuenta está vinculada. Los análisis del bot se guardarán automáticamente y recibirás
            alertas en Telegram cuando el riesgo de tus activos supere los umbrales definidos.
          </p>
        ) : (
          <>
            <p className="text-obsidian-on-var text-[12px] mb-5">
              Vincula tu cuenta para recibir alertas automáticas y sincronizar los análisis del bot con el dashboard.
            </p>

            {!linkCode ? (
              <button
                onClick={generateLinkCode}
                disabled={generatingCode}
                className="bg-primary text-obsidian-bg px-6 py-3 text-[11px] font-bold tracking-[0.2em] hover:bg-primary-dim transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingCode ? 'GENERANDO...' : 'GENERAR CÓDIGO DE VINCULACIÓN'}
              </button>
            ) : (
              <div>
                <div className="text-obsidian-outline text-[10px] tracking-[0.2em] mb-3">
                  TU CÓDIGO (válido 15 minutos):
                </div>
                <div className="bg-obsidian-bg border border-obsidian-outline-var inline-block px-6 py-4 mb-4">
                  <span className="text-primary text-[28px] font-bold tracking-[0.5em]">
                    {linkCode}
                  </span>
                </div>
                <div className="text-obsidian-on-var text-[11px] mb-4">
                  Abre el bot en Telegram:{' '}
                  <a
                    href="https://t.me/velveteen_stochasto_green_bot"
                    target="_blank"
                    className="text-primary no-underline hover:text-primary-dim"
                  >
                    @velveteen_stochasto_green_bot
                  </a>{' '}
                  y envía:{' '}
                  <span className="text-primary">/link {linkCode}</span>
                </div>
                <button
                  onClick={() => { setLinkCode(null); checkTelegramStatus() }}
                  className="bg-transparent border border-obsidian-outline-var text-obsidian-on-var px-4 py-2 text-[10px] tracking-[0.1em] hover:border-primary/60 hover:text-primary transition-colors"
                >
                  YA LO HICE — VERIFICAR
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Alerts feed */}
      <div className="text-primary text-[10px] tracking-[0.28em] mb-4">
        ALERTAS DE RIESGO · CVaR &gt; 10% ó VENDER
      </div>

      {alerts.length === 0 ? (
        <div className="border border-obsidian-outline-var p-12 text-center">
          <div className="text-success text-[13px] mb-2">Sin alertas activas</div>
          <div className="text-obsidian-outline text-[11px]">
            Todos los activos analizados tienen riesgo bajo (CVaR ≤ 10% y veredicto COMPRAR).
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {alerts.map(a => (
            <div
              key={a.id}
              className={`border ${SEV_BORDER[a.severity]} ${SEV_BG[a.severity]} px-5 py-4 grid items-center gap-5`}
              style={{ gridTemplateColumns: 'auto 1fr auto auto' }}
            >
              <div className={`border ${SEV_BORDER[a.severity]} ${SEV_TEXT[a.severity]} px-2 py-0.5 text-[9px] tracking-[0.2em] font-bold whitespace-nowrap`}>
                {a.severity}
              </div>
              <div>
                <div className={`text-[13px] font-bold tracking-wide ${SEV_TEXT[a.severity]}`}>
                  {a.ticker}
                </div>
                <div className="text-obsidian-outline text-[10px] mt-0.5">
                  {new Date(a.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  {a.climate_beta != null && (
                    <span className="ml-3">β={a.climate_beta.toFixed(1)}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-obsidian-outline text-[9px] tracking-[0.1em]">CVaR 95%</div>
                <div className={`text-[14px] font-bold ${SEV_TEXT[a.severity]}`}>
                  {a.cvar_95 != null ? `${a.cvar_95.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                {a.verdict_action ? (
                  <span className={`border px-2.5 py-1 text-[10px] tracking-[0.1em] font-bold ${SEV_TEXT[a.severity]} ${SEV_BORDER[a.severity]}`}>
                    {a.verdict_action}
                  </span>
                ) : (
                  <span className="text-obsidian-outline">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
