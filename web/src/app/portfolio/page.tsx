'use client'

import { useEffect, useState } from 'react'
import { createClient }        from '@/lib/supabase'
import { useRouter }           from 'next/navigation'
import type { VerdictAction }  from '@/lib/supabase'

type Asset = {
  ticker:               string
  created_at:           string
  latest_cvar?:         number
  latest_verdict_action?: VerdictAction | null
}

const VERDICT_COLORS: Record<VerdictAction, string> = {
  COMPRAR:  '#4ade80',
  MANTENER: '#f5c347',
  VENDER:   '#ff6b6b',
}

export default function PortfolioPage() {
  const supabase = createClient()
  const router = useRouter()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPortfolio()
  }, [])

  async function loadPortfolio() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: analyses } = await supabase
      .from('risk_analyses')
      .select('ticker, cvar_95, verdict_action, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!analyses) {
      setLoading(false)
      return
    }

    const seen = new Set<string>()
    const dedupedAssets: Asset[] = []
    for (const analysis of analyses) {
      const ticker = analysis.ticker?.toUpperCase()
      if (!ticker || seen.has(ticker)) continue
      seen.add(ticker)
      dedupedAssets.push({
        ticker,
        created_at:           analysis.created_at,
        latest_cvar:          analysis.cvar_95 ?? undefined,
        latest_verdict_action: analysis.verdict_action ?? null,
      })
    }

    setAssets(dedupedAssets)
    setLoading(false)
  }

  async function removeTicker(ticker: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    await supabase.from('risk_analyses').delete().eq('user_id', user.id).eq('ticker', ticker)
    setAssets((prev) => prev.filter((a) => a.ticker !== ticker))
  }

  const cell: React.CSSProperties = {
    padding: '14px 16px',
    borderBottom: '1px solid #1a1a1c',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#ccc',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ padding: '32px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ color: '#f5c347', fontSize: '10px', letterSpacing: '3px', marginBottom: '4px' }}>
        PORTAFOLIO ACTIVO
      </div>
      <h1 style={{ color: '#e0e0e0', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
        Mis Activos
      </h1>
      <p style={{ color: '#555', fontSize: '11px', marginBottom: '32px' }}>
        Agrega activos conversando con el bot de Telegram ·{' '}
        <a
          href='https://t.me/velveteen_stochasto_green_bot'
          target='_blank'
          style={{ color: '#57f1db', textDecoration: 'none' }}
        >
          @velveteen_stochasto_green_bot
        </a>
      </p>

      {loading ? (
        <div style={{ color: '#444', fontSize: '12px' }}>Cargando portafolio...</div>
      ) : assets.length === 0 ? (
        <div
          style={{
            border: '1px solid #1a1a1c',
            padding: '48px',
            textAlign: 'center',
            color: '#444',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '13px', marginBottom: '8px', color: '#666' }}>
            Sin activos en el portafolio
          </div>
          <div style={{ fontSize: '11px', color: '#444' }}>
            Habla con el bot de Telegram para analizar tus primeros activos.
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
              {['TICKER', 'CVaR 95%', 'VEREDICTO', 'AGREGADO', 'ACCION'].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cell,
                    color: '#555',
                    fontSize: '10px',
                    letterSpacing: '2px',
                    textAlign: 'left',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const cvar = asset.latest_cvar
              const cvarColor = cvar == null ? '#555' : cvar > 20 ? '#ff6b6b' : cvar > 10 ? '#f5c347' : '#4ade80'
              return (
                <tr key={asset.ticker} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ ...cell, color: '#57f1db', fontWeight: '700' }}>{asset.ticker}</td>
                  <td style={{ ...cell, color: cvarColor }}>{cvar != null ? `${cvar.toFixed(1)}%` : '—'}</td>
                  <td style={cell}>
                    {asset.latest_verdict_action ? (
                      <span style={{
                        color:         VERDICT_COLORS[asset.latest_verdict_action],
                        border:        `1px solid ${VERDICT_COLORS[asset.latest_verdict_action]}40`,
                        padding:       '2px 8px',
                        fontSize:      '10px',
                        letterSpacing: '1px',
                        fontWeight:    '700',
                        fontFamily:    "'JetBrains Mono', monospace",
                      }}>
                        {asset.latest_verdict_action}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...cell, color: '#444', fontSize: '11px' }}>
                    {new Date(asset.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td style={cell}>
                    <button
                      onClick={() => removeTicker(asset.ticker)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #3a1a1a',
                        color: '#ff6b6b',
                        padding: '4px 10px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                      }}
                    >
                      QUITAR
                    </button>
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
