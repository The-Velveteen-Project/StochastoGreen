'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient }                from '@/lib/supabase'
import { useRouter }                   from 'next/navigation'
import type { VerdictAction }          from '@/lib/supabase'

type Asset = {
  assetId:              string
  ticker:               string
  added_at:             string
  latest_cvar:          number | null
  latest_verdict_action: VerdictAction | null
}

const VERDICT_COLORS: Record<VerdictAction, string> = {
  COMPRAR:  'text-success border-success/40',
  MANTENER: 'text-warn border-warn/40',
  VENDER:   'text-danger border-danger/40',
}

export default function PortfolioPage() {
  const supabase      = createClient()
  const router        = useRouter()
  const portfolioRef  = useRef<string | null>(null)
  const userIdRef     = useRef<string | null>(null)

  const [assets,  setAssets]  = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      userIdRef.current = user.id

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

      let { data: pa } = await supabase
        .from('portfolio_assets')
        .select('id, ticker, added_at')
        .eq('portfolio_id', portfolioId)
        .order('added_at', { ascending: false })

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

      channel = supabase
        .channel('portfolio-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'risk_analyses' }, async (payload) => {
          const row    = payload.new as Record<string, unknown>
          if (row.user_id !== userIdRef.current) return
          const ticker = (row.ticker as string)?.toUpperCase()
          if (!ticker || !portfolioRef.current) return

          setAssets(prev => {
            if (prev.find(a => a.ticker === ticker)) return prev
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

  async function removeTicker(assetId: string) {
    await supabase.from('portfolio_assets').delete().eq('id', assetId)
    setAssets(prev => prev.filter(a => a.assetId !== assetId))
  }

  const cellClass = 'px-4 py-3.5 border-b border-obsidian-outline-var/60 text-[13px] font-mono text-obsidian-on-var align-middle'
  const headClass = 'px-4 py-3.5 border-b border-obsidian-outline-var text-[10px] tracking-[0.2em] text-obsidian-outline text-left font-mono'

  return (
    <div className="p-8 font-mono">
      <div className="text-primary text-[10px] tracking-[0.28em] mb-1">
        PORTAFOLIO ACTIVO
      </div>
      <h1 className="text-obsidian-on text-[20px] font-bold mb-2">
        Mis Activos
      </h1>
      <p className="text-obsidian-outline text-[11px] mb-8">
        Agrega activos conversando con el bot de Telegram ·{' '}
        <a
          href="https://t.me/velveteen_stochasto_green_bot"
          target="_blank"
          className="text-primary no-underline hover:text-primary-dim"
        >
          @velveteen_stochasto_green_bot
        </a>
        <span className="text-obsidian-outline-var ml-3">
          · Quitar oculta del portafolio sin borrar el historial
        </span>
      </p>

      {loading ? (
        <div className="text-obsidian-outline text-[12px]">Cargando portafolio...</div>
      ) : assets.length === 0 ? (
        <div className="border border-obsidian-outline-var p-12 text-center">
          <div className="text-obsidian-on-var text-[13px] mb-2">Sin activos en el portafolio</div>
          <div className="text-obsidian-outline text-[11px]">
            Habla con el bot de Telegram para analizar tus primeros activos.
          </div>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-obsidian-outline-var">
              {['TICKER', 'CVaR 95%', 'VEREDICTO', 'AGREGADO', 'ACCIÓN'].map((h) => (
                <th key={h} className={headClass}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const cvar      = asset.latest_cvar
              const cvarClass = cvar == null ? 'text-obsidian-outline' : cvar > 20 ? 'text-danger' : cvar > 10 ? 'text-warn' : 'text-success'
              return (
                <tr key={asset.assetId}>
                  <td className={`${cellClass} text-primary font-bold`}>{asset.ticker}</td>
                  <td className={`${cellClass} ${cvarClass}`}>
                    {cvar != null ? `${cvar.toFixed(1)}%` : '—'}
                  </td>
                  <td className={cellClass}>
                    {asset.latest_verdict_action ? (
                      <span className={`border px-2 py-0.5 text-[10px] tracking-[0.1em] font-bold font-mono ${VERDICT_COLORS[asset.latest_verdict_action]}`}>
                        {asset.latest_verdict_action}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={`${cellClass} text-obsidian-outline text-[11px]`}>
                    {new Date(asset.added_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className={cellClass}>
                    <button
                      onClick={() => removeTicker(asset.assetId)}
                      title="Quitar del portafolio (el historial de análisis se conserva)"
                      className="bg-transparent border border-obsidian-outline-var text-obsidian-on-var px-2.5 py-1 text-[10px] font-mono tracking-[0.1em] hover:border-danger/60 hover:text-danger transition-colors"
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
