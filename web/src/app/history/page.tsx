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
  COMPRAR:  '#4ade80',
  MANTENER: '#f5c347',
  VENDER:   '#ff6b6b',
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

  const cell: React.CSSProperties = {
    padding:      '12px 16px',
    borderBottom: '1px solid #111',
    fontSize:     '12px',
    fontFamily:   "'JetBrains Mono', monospace",
    color:        '#ccc',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ padding: '32px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ color: '#f5c347', fontSize: '10px', letterSpacing: '3px', marginBottom: '4px' }}>
        SUPABASE · TIEMPO REAL
      </div>
      <h1 style={{ color: '#e0e0e0', fontSize: '20px', fontWeight: '700', marginBottom: '32px' }}>
        Historial de Análisis
      </h1>

      {loading ? (
        <div style={{ color: '#444', fontSize: '12px' }}>Cargando historial...</div>
      ) : analyses.length === 0 ? (
        <div style={{ border: '1px solid #1a1a1c', padding: '48px', textAlign: 'center', color: '#444' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📋</div>
          <div style={{ fontSize: '13px', color: '#666' }}>Sin análisis registrados aún</div>
          <div style={{ fontSize: '11px', marginTop: '8px', color: '#444' }}>
            Los análisis del bot aparecerán aquí automáticamente.
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['TICKER', 'CVaR 95%', 'SHOCK PROB.', 'BETA CLIMÁTICO', 'ACCIÓN', 'CONFIANZA', 'FECHA'].map((h) => (
                <th key={h} style={{
                  ...cell,
                  color: '#555', fontSize: '10px', letterSpacing: '2px',
                  textAlign: 'left', borderBottom: '1px solid #2a2a2a',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => {
              const cvar       = a.cvar_95
              const cvarColor  = cvar == null ? '#555' : cvar > 20 ? '#ff6b6b' : cvar > 10 ? '#f5c347' : '#4ade80'
              const action     = a.verdict_action
              const actionColor = action ? VERDICT_COLORS[action] : '#555'
              return (
                <tr key={a.id}>
                  <td style={{ ...cell, color: '#57f1db', fontWeight: '700' }}>{a.ticker}</td>
                  <td style={{ ...cell, color: cvarColor }}>
                    {cvar != null ? `${cvar.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ ...cell, color: '#888' }}>
                    {a.jump_prob != null ? `${a.jump_prob.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ ...cell, color: '#888' }}>
                    {a.climate_beta != null ? a.climate_beta.toFixed(1) : '—'}
                  </td>
                  <td style={{ ...cell }}>
                    {action ? (
                      <span style={{
                        color:        actionColor,
                        border:       `1px solid ${actionColor}40`,
                        padding:      '2px 8px',
                        fontSize:     '10px',
                        letterSpacing: '1px',
                        fontWeight:   '700',
                      }}>
                        {action}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...cell }}>
                    {a.verdict_confidence != null ? (() => {
                      const pct = Math.round(a.verdict_confidence * 100)
                      const barColor = pct >= 70 ? '#4ade80' : pct >= 40 ? '#f5c347' : '#ff6b6b'
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '72px' }}>
                          <div style={{ flex: 1, height: '3px', background: '#2a2a2a', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '10px', color: barColor, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                            {pct}%
                          </span>
                        </div>
                      )
                    })() : <span style={{ color: '#555' }}>—</span>}
                  </td>
                  <td style={{ ...cell, color: '#444', fontSize: '11px' }}>
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
