'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase'
import { useRouter }           from 'next/navigation'
import type { VerdictAction }  from '@/lib/supabase'

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

const VERDICT_COLORS: Record<VerdictAction, string> = {
  COMPRAR:  'text-success border-success/40',
  MANTENER: 'text-warn border-warn/40',
  VENDER:   'text-danger border-danger/40',
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

  const cellClass = 'px-4 py-3 border-b border-obsidian-outline-var/50 text-[12px] font-mono text-obsidian-on-var align-middle'
  const headClass = 'px-4 py-3 border-b border-obsidian-outline-var text-[10px] tracking-[0.2em] text-obsidian-outline text-left font-mono'

  return (
    <div className="p-8 font-mono">
      <div className="text-primary text-[10px] tracking-[0.28em] mb-1">
        HISTORIAL DE ANÁLISIS
      </div>
      <h1 className="text-obsidian-on text-[20px] font-bold mb-8">
        Análisis recientes
      </h1>

      {loading ? (
        <div className="text-obsidian-outline text-[12px]">Cargando historial...</div>
      ) : analyses.length === 0 ? (
        <div className="border border-obsidian-outline-var p-12 text-center">
          <div className="text-obsidian-on-var text-[13px] mb-2">Sin análisis registrados</div>
          <div className="text-obsidian-outline text-[11px]">
            Los análisis del bot aparecerán aquí automáticamente.
          </div>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['TICKER', 'CVaR 95%', 'SHOCK PROB.', 'β CLIMÁTICO', 'ACCIÓN', 'CONFIANZA', 'FECHA'].map((h) => (
                <th key={h} className={headClass}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => {
              const cvar       = a.cvar_95
              const cvarClass  = cvar == null ? 'text-obsidian-outline' : cvar > 20 ? 'text-danger' : cvar > 10 ? 'text-warn' : 'text-success'
              const action     = a.verdict_action
              return (
                <tr key={a.id}>
                  <td className={`${cellClass} text-primary font-bold`}>{a.ticker}</td>
                  <td className={`${cellClass} ${cvarClass}`}>
                    {cvar != null ? `${cvar.toFixed(1)}%` : '—'}
                  </td>
                  <td className={cellClass}>
                    {a.jump_prob != null ? `${a.jump_prob.toFixed(1)}%` : '—'}
                  </td>
                  <td className={cellClass}>
                    {a.climate_beta != null ? a.climate_beta.toFixed(1) : '—'}
                  </td>
                  <td className={cellClass}>
                    {action ? (
                      <span className={`border px-2 py-0.5 text-[10px] tracking-[0.1em] font-bold ${VERDICT_COLORS[action]}`}>
                        {action}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={cellClass}>
                    {a.verdict_confidence != null ? (() => {
                      const pct = Math.round(a.verdict_confidence * 100)
                      const barClass = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warn' : 'bg-danger'
                      const textClass = pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warn' : 'text-danger'
                      return (
                        <div className="flex items-center gap-1.5 min-w-[72px]">
                          <div className="flex-1 h-[3px] bg-obsidian-outline-var rounded-sm overflow-hidden">
                            <div className={`h-full rounded-sm ${barClass}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[10px] whitespace-nowrap ${textClass}`}>
                            {pct}%
                          </span>
                        </div>
                      )
                    })() : <span className="text-obsidian-outline">—</span>}
                  </td>
                  <td className={`${cellClass} text-obsidian-outline text-[11px]`}>
                    {new Date(a.created_at).toLocaleString('es-CO', {
                      dateStyle: 'short', timeStyle: 'short',
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
