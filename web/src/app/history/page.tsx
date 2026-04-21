'use client'

import { useEffect, useState } from 'react'
import { createClient, type VerdictAction } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TerminalShell } from '@/components/layout/TerminalShell'
import { EmptyState } from '@/components/ui/EmptyState'

type Analysis = {
  id:                  string
  ticker:              string
  cvar_95:             number | null
  jump_prob:           number | null
  verdict_action:      VerdictAction | null
  verdict_confidence:  number | null
  climate_beta:        number | null
  created_at:          string
}

const VERDICT_BADGES: Record<VerdictAction, string> = {
  COMPRAR: 'bg-success/10 text-success border-success/30',
  MANTENER: 'bg-primary/10 text-primary border-primary/30',
  VENDER: 'bg-danger/10 text-danger border-danger/30',
}

export default function HistoryPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    loadHistory()

    const channel = supabase
      .channel('history-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'risk_analyses' }, (payload) => {
        setAnalyses((prev) => [payload.new as Analysis, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('risk_analyses')
      .select('id, ticker, cvar_95, jump_prob, verdict_action, verdict_confidence, climate_beta, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setAnalyses(data || [])
    setLoading(false)
  }

  return (
    <TerminalShell>
      <div className="mb-8">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-primary uppercase mb-2">Stream · en vivo</div>
        <h1 className="font-display text-xl font-bold text-obsidian-on">Historial de análisis</h1>
      </div>

      {loading ? (
        <div className="font-mono text-[0.75rem] text-obsidian-on-var">Cargando historial...</div>
      ) : analyses.length === 0 ? (
        <EmptyState
          eyebrow="HISTORIAL"
          title="Sin análisis registrados"
          description="Los análisis del bot aparecerán aquí automáticamente."
          action={
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-mono text-[0.65rem] tracking-widest uppercase"
            >
              Ir al dashboard
            </Link>
          }
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-obsidian-outline-var">
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Ticker</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">CVaR 95%</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Shock prob.</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Beta climático</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Acción</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Confianza</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-outline-var/30">
              {analyses.map((a) => {
                const cvar = a.cvar_95
                const cvarClass = cvar == null ? 'text-obsidian-outline' : cvar > 20 ? 'text-danger' : cvar > 10 ? 'text-primary' : 'text-success'
                const action = a.verdict_action
                const confidencePct = a.verdict_confidence == null ? null : Math.round(a.verdict_confidence * 100)
                const confidenceClass =
                  confidencePct == null ? 'text-obsidian-outline' : confidencePct >= 70 ? 'text-success' : confidencePct >= 40 ? 'text-primary' : 'text-danger'
                const confidenceBarClass =
                  confidencePct == null ? 'bg-obsidian-outline' : confidencePct >= 70 ? 'bg-success' : confidencePct >= 40 ? 'bg-primary' : 'bg-danger'

                return (
                  <tr key={a.id} className="hover:bg-obsidian-mid transition-colors">
                    <td className="p-4 font-mono text-[0.72rem] text-secondary font-bold tracking-widest">{a.ticker}</td>
                    <td className={`p-4 font-mono text-[0.72rem] font-bold ${cvarClass}`}>
                      {cvar != null ? `${cvar.toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-4 font-mono text-[0.72rem] text-obsidian-on-var">
                      {a.jump_prob != null ? `${a.jump_prob.toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-4 font-mono text-[0.72rem] text-obsidian-on-var">
                      {a.climate_beta != null ? a.climate_beta.toFixed(1) : '—'}
                    </td>
                    <td className="p-4">
                      {action ? (
                        <span className={`font-mono text-[0.58rem] font-bold px-2 py-0.5 tracking-widest border ${VERDICT_BADGES[action]}`}>
                          {action}
                        </span>
                      ) : (
                        <span className="font-mono text-[0.72rem] text-obsidian-outline">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {confidencePct == null ? (
                        <span className="font-mono text-[0.72rem] text-obsidian-outline">—</span>
                      ) : (
                        <div className="flex items-center gap-2 min-w-[88px]">
                          <div className="flex-1 h-1 bg-obsidian-outline-var rounded overflow-hidden">
                            <div className={`h-full ${confidenceBarClass}`} style={{ width: `${confidencePct}%` }} />
                          </div>
                          <span className={`font-mono text-[0.58rem] ${confidenceClass}`}>{confidencePct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[0.72rem] text-obsidian-outline">
                      {new Date(a.created_at).toLocaleString('es-CO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TerminalShell>
  )
}
