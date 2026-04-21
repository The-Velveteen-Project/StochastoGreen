'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, type VerdictAction } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TerminalShell } from '@/components/layout/TerminalShell'
import { EmptyState } from '@/components/ui/EmptyState'

type Asset = {
  assetId:              string        // portfolio_assets.id — usado sólo para DELETE
  ticker:               string
  added_at:             string
  latest_cvar:          number | null
  latest_verdict_action: VerdictAction | null
}

const VERDICT_BADGES: Record<VerdictAction, string> = {
  COMPRAR: 'bg-success/10 text-success border-success/30',
  MANTENER: 'bg-primary/10 text-primary border-primary/30',
  VENDER: 'bg-danger/10 text-danger border-danger/30',
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

  return (
    <TerminalShell>
      <div className="mb-8">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-primary uppercase mb-2">Portafolio activo</div>
        <h1 className="font-display text-xl font-bold text-obsidian-on">Mis activos</h1>
        <p className="mt-2 text-obsidian-on-var text-[0.85rem]">
          Agrega activos conversando con el bot de Telegram:{' '}
          <a
            href="https://t.me/velveteen_stochasto_green_bot"
            target="_blank"
            rel="noreferrer"
            className="text-secondary hover:text-obsidian-on transition-colors font-mono"
          >
            @velveteen_stochasto_green_bot
          </a>
          .
        </p>
        <div className="mt-2 font-mono text-[0.58rem] tracking-widest text-obsidian-outline uppercase">
          Quitar oculta del portafolio sin borrar historial
        </div>
      </div>

      {loading ? (
        <div className="font-mono text-[0.75rem] text-obsidian-on-var">Cargando portafolio...</div>
      ) : assets.length === 0 ? (
        <EmptyState
          eyebrow="PORTAFOLIO"
          title="Sin activos todavía"
          description="Los activos analizados por el bot aparecerán aquí automáticamente."
          action={
            <a
              href="https://t.me/velveteen_stochasto_green_bot"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-mono text-[0.65rem] tracking-widest uppercase"
            >
              Abrir bot de Telegram
            </a>
          }
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-obsidian-outline-var">
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Ticker</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">CVaR 95%</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Acción</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Agregado</th>
                <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-outline-var/30">
              {assets.map((asset) => {
                const cvar = asset.latest_cvar
                const cvarClass = cvar == null ? 'text-obsidian-outline' : cvar > 20 ? 'text-danger' : cvar > 10 ? 'text-primary' : 'text-success'
                const verdict = asset.latest_verdict_action

                return (
                  <tr key={asset.assetId} className="hover:bg-obsidian-mid transition-colors">
                    <td className="p-4 font-mono text-[0.72rem] text-secondary font-bold tracking-widest">
                      {asset.ticker}
                    </td>
                    <td className={`p-4 font-mono text-[0.72rem] font-bold ${cvarClass}`}>
                      {cvar != null ? `${cvar.toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-4">
                      {verdict ? (
                        <span
                          className={`font-mono text-[0.58rem] font-bold px-2 py-0.5 tracking-widest border ${VERDICT_BADGES[verdict]}`}
                        >
                          {verdict}
                        </span>
                      ) : (
                        <span className="font-mono text-[0.72rem] text-obsidian-outline">—</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[0.72rem] text-obsidian-outline">
                      {new Date(asset.added_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => removeTicker(asset.assetId)}
                        title="Quitar del portafolio (el historial de análisis se conserva)"
                        className="px-2.5 py-1 border border-danger/40 text-danger hover:bg-danger/10 transition-colors font-mono text-[0.6rem] tracking-widest uppercase"
                      >
                        Quitar
                      </button>
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
