'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient }                from '@/lib/supabase'
import { useRouter }                   from 'next/navigation'
import type { VerdictAction }          from '@/lib/supabase'

type Asset = {
  assetId:              string        // portfolio_assets.id — usado sólo para DELETE
  ticker:               string
  added_at:             string
  latest_cvar:          number | null
  latest_verdict_action: VerdictAction | null
}

const VERDICT_COLORS: Record<VerdictAction, string> = {
  COMPRAR:  '#4ade80',
  MANTENER: '#f5c347',
  VENDER:   '#ff6b6b',
}

export default function PortfolioPage() {
  const supabase      = createClient()
  const router        = useRouter()
  const portfolioRef  = useRef<string | null>(null)   // portfolio_id estable entre renders
  const userIdRef     = useRef<string | null>(null)

  const [assets,  setAssets]  = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      userIdRef.current = user.id

      // ── 1. Obtener o crear el portafolio principal ────────────────────────
      let portfolioId: string
      const { data: existing } = await supabase
        .from('portfolios')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (existing) {
        portfolioId = existing.id
      } else {
        const { data: created } = await supabase
          .from('portfolios')
          .insert({ user_id: user.id, name: 'Principal' })
          .select('id')
          .single()
        if (!created) { setLoading(false); return }
        portfolioId = created.id
      }
      portfolioRef.current = portfolioId

      // ── 2. Cargar assets del portafolio ───────────────────────────────────
      let { data: pa } = await supabase
        .from('portfolio_assets')
        .select('id, ticker, added_at')
        .eq('portfolio_id', portfolioId)
        .order('added_at', { ascending: false })

      // ── 3. Semilla automática: si el portafolio está vacío y hay análisis ─
      if (!pa || pa.length === 0) {
        const { data: analyses } = await supabase
          .from('risk_analyses')
          .select('ticker')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (analyses && analyses.length > 0) {
          const seen    = new Set<string>()
          const toInsert = analyses
            .map(a => a.ticker?.toUpperCase())
            .filter((t): t is string => !!t && !seen.has(t) && !seen.add(t))
            .map(ticker => ({ portfolio_id: portfolioId, ticker }))

          if (toInsert.length > 0) {
            await supabase.from('portfolio_assets').insert(toInsert)
            const { data: seeded } = await supabase
              .from('portfolio_assets')
              .select('id, ticker, added_at')
              .eq('portfolio_id', portfolioId)
              .order('added_at', { ascending: false })
            pa = seeded
          }
        }
      }

      // ── 4. Enriquecer con última análisis por ticker (una sola query) ─────
      const { data: allAnalyses } = await supabase
        .from('risk_analyses')
        .select('ticker, cvar_95, verdict_action, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const latestMap = new Map<string, { cvar_95: number | null; verdict_action: VerdictAction | null }>()
      for (const row of allAnalyses ?? []) {
        const t = row.ticker?.toUpperCase()
        if (t && !latestMap.has(t))
          latestMap.set(t, { cvar_95: row.cvar_95, verdict_action: row.verdict_action as VerdictAction | null })
      }

      const enriched: Asset[] = (pa ?? []).map(row => {
        const ticker = row.ticker?.toUpperCase() ?? ''
        const latest = latestMap.get(ticker)
        return {
          assetId:              row.id,
          ticker,
          added_at:             row.added_at,
          latest_cvar:          latest?.cvar_95 ?? null,
          latest_verdict_action: latest?.verdict_action ?? null,
        }
      }).filter(a => a.ticker)

      setAssets(enriched)
      setLoading(false)

      // ── 5. Realtime: auto-agregar nuevos tickers cuando se analicen ───────
      channel = supabase
        .channel('portfolio-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'risk_analyses' }, async (payload) => {
          const row    = payload.new as Record<string, unknown>
          if (row.user_id !== userIdRef.current) return
          const ticker = (row.ticker as string)?.toUpperCase()
          if (!ticker || !portfolioRef.current) return

          setAssets(prev => {
            if (prev.find(a => a.ticker === ticker)) return prev  // ya existe
            // Insertar en portfolio_assets (ignorar duplicado si ya existe)
            supabase
              .from('portfolio_assets')
              .insert({ portfolio_id: portfolioRef.current!, ticker })
              .select('id, added_at')
              .single()
              .then(({ data }) => {
                if (!data) return
                setAssets(p => p.find(a => a.ticker === ticker) ? p : [{
                  assetId:              data.id,
                  ticker,
                  added_at:             data.added_at,
                  latest_cvar:          row.cvar_95 as number | null,
                  latest_verdict_action: row.verdict_action as VerdictAction | null,
                }, ...p])
              })
            return prev
          })
        })
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  // ── Quitar: sólo elimina de portfolio_assets, nunca de risk_analyses ─────
  async function removeTicker(assetId: string) {
    await supabase.from('portfolio_assets').delete().eq('id', assetId)
    setAssets(prev => prev.filter(a => a.assetId !== assetId))
  }

  const cell: React.CSSProperties = {
    padding:       '14px 16px',
    borderBottom:  '1px solid #1a1a1c',
    fontSize:      '13px',
    fontFamily:    "'JetBrains Mono', monospace",
    color:         '#ccc',
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
        <a href='https://t.me/velveteen_stochasto_green_bot' target='_blank'
          style={{ color: '#57f1db', textDecoration: 'none' }}>
          @velveteen_stochasto_green_bot
        </a>
        <span style={{ color: '#333', marginLeft: '12px' }}>
          · QUITAR oculta del portafolio sin borrar el historial de análisis
        </span>
      </p>

      {loading ? (
        <div style={{ color: '#444', fontSize: '12px' }}>Cargando portafolio...</div>
      ) : assets.length === 0 ? (
        <div style={{ border: '1px solid #1a1a1c', padding: '48px', textAlign: 'center', color: '#444' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '13px', marginBottom: '8px', color: '#666' }}>Sin activos en el portafolio</div>
          <div style={{ fontSize: '11px', color: '#444' }}>
            Habla con el bot de Telegram para analizar tus primeros activos.
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
              {['TICKER', 'CVaR 95%', 'VEREDICTO', 'AGREGADO', 'ACCION'].map((h) => (
                <th key={h} style={{
                  ...cell, color: '#555', fontSize: '10px', letterSpacing: '2px',
                  textAlign: 'left', borderBottom: '1px solid #2a2a2a',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const cvar      = asset.latest_cvar
              const cvarColor = cvar == null ? '#555' : cvar > 20 ? '#ff6b6b' : cvar > 10 ? '#f5c347' : '#4ade80'
              return (
                <tr key={asset.assetId} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ ...cell, color: '#57f1db', fontWeight: '700' }}>{asset.ticker}</td>
                  <td style={{ ...cell, color: cvarColor }}>
                    {cvar != null ? `${cvar.toFixed(1)}%` : '—'}
                  </td>
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
                    {new Date(asset.added_at).toLocaleDateString('es-CO')}
                  </td>
                  <td style={cell}>
                    <button
                      onClick={() => removeTicker(asset.assetId)}
                      title="Quitar del portafolio (el historial de análisis se conserva)"
                      style={{
                        background:  'transparent',
                        border:      '1px solid #3a1a1a',
                        color:       '#ff6b6b',
                        padding:     '4px 10px',
                        fontSize:    '10px',
                        cursor:      'pointer',
                        fontFamily:  "'JetBrains Mono', monospace",
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
