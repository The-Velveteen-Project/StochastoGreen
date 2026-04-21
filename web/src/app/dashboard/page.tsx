"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { createClient } from '@/lib/supabase';
import type { RiskAnalysis, SimulationPaths, VerdictAction } from '@/lib/supabase';

type EsgDatum = {
  name: string
  value: number
  color: string
}

type TickerRiskDatum = {
  name: string
  cvar: number
  climate_beta: number | null
  color: string
}

type SimulationDatum = {
  t: number
  media: number
  p95: number
  p5: number
}

// ─── ESG classification from NGFS Phase 4 climate_beta ───────────────────────
function betaToEsgClass(beta: number | null): 'Verde' | 'Transición' | 'Brown' {
  if (beta == null) return 'Transición'
  if (beta >= 1.3)  return 'Brown'
  if (beta >= 1.0)  return 'Transición'
  return 'Verde'
}

function computeEsgData(rows: { climate_beta: number | null }[]) {
  const total = rows.length
  if (total === 0) return [
    { name: 'Verdes',         value: 0, color: '#4ade80' },
    { name: 'En Transición',  value: 0, color: '#f5c347' },
    { name: 'Brown Assets',   value: 0, color: '#ff6b6b' },
  ] as EsgDatum[]
  let green = 0, transition = 0, brown = 0
  for (const r of rows) {
    const cls = betaToEsgClass(r.climate_beta)
    if (cls === 'Verde')      green++
    else if (cls === 'Brown') brown++
    else                      transition++
  }
  return [
    { name: 'Verdes',        value: Math.round((green      / total) * 100), color: '#4ade80' },
    { name: 'En Transición', value: Math.round((transition / total) * 100), color: '#f5c347' },
    { name: 'Brown Assets',  value: Math.round((brown      / total) * 100), color: '#ff6b6b' },
  ]
}

// ─── Verdict helpers ──────────────────────────────────────────────────────────
const VERDICT_COLOR: Record<VerdictAction, 'success' | 'danger' | 'primary'> = {
  COMPRAR:  'success',
  VENDER:   'danger',
  MANTENER: 'primary',
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const supabase = createClient()
  const [analyses,         setAnalyses]         = useState<RiskAnalysis[]>([])
  const [latestAnalysis,   setLatestAnalysis]   = useState<RiskAnalysis | null>(null)
  const [tickerRisk,       setTickerRisk]       = useState<TickerRiskDatum[]>([])
  const [uniqueTickerCount,setUniqueTickerCount] = useState(0)
  const [simulationData,   setSimulationData]   = useState<SimulationDatum[]>([])
  const [esgData,          setEsgData]          = useState<EsgDatum[]>([])
  const [avgBeta,          setAvgBeta]          = useState<string>('—')
  const [loading,          setLoading]          = useState(true)

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Latest single row (for KPIs + simulation paths)
    const { data: latestRowsRaw } = await supabase
      .from('risk_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const latestRows = (latestRowsRaw ?? []) as RiskAnalysis[]

    // All rows for history table
    const { data: allAnalysesRaw } = await supabase
      .from('risk_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const allAnalyses = (allAnalysesRaw ?? []) as RiskAnalysis[]

    // One row per ticker (latest) for CVaR bars + ESG classification
    const { data: groupedRowsRaw } = await supabase
      .from('risk_analyses')
      .select('ticker, cvar_95, jump_prob, verdict_action, climate_beta, created_at')
      .eq('user_id', user.id)
      .order('ticker',     { ascending: true })
      .order('created_at', { ascending: false })
    const groupedRows = (groupedRowsRaw ?? []) as Pick<RiskAnalysis, 'ticker' | 'cvar_95' | 'jump_prob' | 'verdict_action' | 'climate_beta' | 'created_at'>[]

    // Deduplicate: keep only latest per ticker
    const latestByTicker = new Map<string, Pick<RiskAnalysis, 'ticker' | 'cvar_95' | 'verdict_action' | 'climate_beta' | 'created_at'>>()
    for (const row of groupedRows) {
      const ticker = row.ticker?.toUpperCase()
      if (!ticker || latestByTicker.has(ticker)) continue
      latestByTicker.set(ticker, { ...row, ticker })
    }
    const deduped = Array.from(latestByTicker.values())

    // CVaR bars
    const tickerRiskRows: TickerRiskDatum[] = deduped.map((row) => {
      const cvar = Number(row.cvar_95 ?? 0)
      return {
        name:         row.ticker,
        cvar,
        climate_beta: row.climate_beta,
        color: cvar < 10 ? '#4ade80' : cvar <= 20 ? '#f5c347' : '#ff6b6b',
      }
    })

    // Average climate beta
    if (deduped.length > 0) {
      const sum = deduped.reduce((acc, r) => acc + (r.climate_beta ?? 1.0), 0)
      setAvgBeta((sum / deduped.length).toFixed(2))
    } else {
      setAvgBeta('—')
    }

    // ESG distribution from real climate_beta values
    setEsgData(computeEsgData(deduped))

    // Monte Carlo paths from latest analysis
    const paths = latestRows[0]?.simulation_paths as SimulationPaths | null | undefined
    if (paths?.media) {
      setSimulationData(paths.media.map((val: number, i: number) => ({
        t:     i,
        media: val,
        p95:   paths.optimista[i],
        p5:    paths.cvar_zone[i],
      })))
    } else {
      setSimulationData([])
    }

    setLatestAnalysis(latestRows?.[0] ?? null)
    setAnalyses(allAnalyses)
    setTickerRisk(tickerRiskRows)
    setUniqueTickerCount(tickerRiskRows.length)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const initialize = async () => {
      await loadDashboard()
    }
    void initialize()

    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'risk_analyses' }, () => {
        void loadDashboard()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadDashboard, supabase])

  const portfolioCVar = latestAnalysis?.cvar_95 != null
    ? `${Number(latestAnalysis.cvar_95).toFixed(1)}%`
    : '—'
  const probShock = latestAnalysis?.jump_prob != null
    ? `${Number(latestAnalysis.jump_prob).toFixed(1)}%`
    : '—'

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="flex items-center gap-4">
          <div className="font-mono text-[0.62rem] tracking-[0.14em] text-primary uppercase whitespace-nowrap">
            Visión General del Portafolio
          </div>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-obsidian-outline-var to-transparent" />
        </section>
        <div className="panel p-6 font-mono text-xs text-obsidian-on-var">Cargando dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4">
        <div className="font-mono text-[0.62rem] tracking-[0.14em] text-primary uppercase whitespace-nowrap">
          Visión General del Portafolio
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-obsidian-outline-var to-transparent" />
      </section>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          label="CVAR 95% — ÚLTIMO ANÁLISIS"
          value={portfolioCVar}
          color="text-primary"
          delta={latestAnalysis?.ticker || 'Pendiente'}
          sub="PEOR 5% ESCENARIOS"
          featured
        />
        <KPICard
          label="BETA CLIMÁTICO MEDIO"
          value={avgBeta}
          color={avgBeta !== '—' && Number(avgBeta) >= 1.3 ? 'text-danger' : avgBeta !== '—' && Number(avgBeta) < 1.0 ? 'text-success' : 'text-primary'}
          delta="NGFS Phase 4 · Portfolio"
          sub="MULTIPLICADOR DE RIESGO"
        />
        <KPICard
          label="PROB. SHOCK CLIMÁTICO"
          value={probShock}
          color="text-obsidian-on"
          delta="Poisson λ — anual"
          sub="JUMP-DIFFUSION MODEL"
        />
        <KPICard
          label="ACTIVOS ANALIZADOS"
          value={uniqueTickerCount.toString()}
          color="text-obsidian-on"
          delta={tickerRisk.slice(0, 3).map(a => a.name).join(' · ') || 'Sin análisis'}
          sub="HISTORIAL ACTIVO"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monte Carlo chart */}
        <div className="lg:col-span-2 panel">
          <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center bg-obsidian-low">
            <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Monte Carlo Simulation</h3>
            <span className="font-mono text-[0.58rem] text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 tracking-wider">
              10k paths · Merton Jump-Diffusion
            </span>
          </div>
          <div className="h-[300px] w-full p-4">
            {simulationData.length === 0 ? (
              <div className="h-full flex items-center justify-center font-mono text-xs text-obsidian-on-var opacity-50 text-center px-8">
                Ejecuta un análisis vía Telegram para ver la simulación Monte Carlo.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulationData}>
                  <defs>
                    <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f5c347" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f5c347" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a282c" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #4a484c', fontSize: '12px' }}
                    itemStyle={{ color: '#e8e4e7' }}
                    formatter={(v) => [`${Number(v).toFixed(1)}`, '']}
                    labelFormatter={(t) => `Día ${(Number(t) + 1) * 5}`}
                  />
                  <Area type="monotone" dataKey="p95" stroke="none" fill="#4ade80" fillOpacity={0.05} />
                  <Area type="monotone" dataKey="p5"  stroke="none" fill="#ff6b6b" fillOpacity={0.05} />
                  <Area type="monotone" dataKey="media" stroke="#f5c347" strokeWidth={2} fill="url(#colorMedian)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="p-4 border-t border-obsidian-outline-var flex gap-6">
            <LegendItem color="bg-primary"  label="Trayectoria media (P50)" />
            <LegendItem color="bg-danger"   label="Zona CVaR — peor 5%" />
            <LegendItem color="bg-success"  label="Escenario optimista (P90)" />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* CVaR per asset */}
          <div className="panel">
            <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
              <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">CVaR Por Activo</h3>
              <span className="text-[0.58rem] font-mono text-primary">95% ES</span>
            </div>
            <div className="p-5 space-y-4">
              {tickerRisk.map((ticker) => (
                <div key={ticker.name} className="space-y-1.5">
                  <div className="flex justify-between text-[0.68rem] font-mono">
                    <span className="text-obsidian-on">{ticker.name}</span>
                    <span style={{ color: ticker.color }}>{ticker.cvar.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-obsidian-high w-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((ticker.cvar / 40) * 100, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full"
                      style={{ backgroundColor: ticker.color }}
                    />
                  </div>
                </div>
              ))}
              {tickerRisk.length === 0 && (
                <div className="text-center py-4 text-obsidian-on-var font-mono text-xs opacity-50">
                  Sin activos analizados.
                </div>
              )}
            </div>
          </div>

          {/* ESG Classification — computed from real climate_beta */}
          <div className="panel">
            <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
              <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Clasificación ESG</h3>
              <span className="text-[0.58rem] font-mono text-primary">NGFS β</span>
            </div>
            <div className="p-5 space-y-3">
              {esgData.length > 0 && esgData.every(d => d.value === 0) ? (
                <div className="text-center py-2 text-obsidian-on-var font-mono text-xs opacity-50">
                  Sin datos de clasificación aún.
                </div>
              ) : (
                esgData.map(item => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[0.78rem] text-obsidian-on-var flex-1">{item.name}</span>
                      <span className="text-[0.68rem] font-mono text-obsidian-on">{item.value}%</span>
                    </div>
                    <div className="h-1 bg-obsidian-high w-full overflow-hidden ml-5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full"
                        style={{ backgroundColor: item.color, opacity: 0.6 }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Executive verdicts */}
        <div className="panel">
          <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
            <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Veredictos Ejecutivos</h3>
            <span className="text-[0.58rem] font-mono text-primary">AGENTE IA</span>
          </div>
          <div className="p-4 space-y-3">
            {analyses.slice(0, 3).map((a, i) => {
              const action: VerdictAction = a.verdict_action ?? 'MANTENER'
              const color = VERDICT_COLOR[action]
              const text  = a.verdict_justification
                ? a.verdict_justification.split('.')[0] + '.'
                : '—'
              return (
                <VerdictCard key={i} ticker={a.ticker} action={action} color={color} text={text} confidence={a.verdict_confidence} />
              )
            })}
            {analyses.length === 0 && (
              <div className="text-center py-8 text-obsidian-on-var font-mono text-xs opacity-50">
                Esperando análisis del Bot...
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
            <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Historial de Análisis</h3>
            <span className="text-[0.58rem] font-mono text-primary">EVENT STREAM</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-obsidian-outline-var">
                  {['Ticker', 'Fecha', 'CVaR 95%', 'Acción'].map(h => (
                    <th key={h} className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-outline-var/30">
                {analyses.slice(0, 8).map((a, i) => {
                  const action: VerdictAction = a.verdict_action ?? 'MANTENER'
                  const cvarNum = Number(a.cvar_95 ?? 0)
                  const type    = cvarNum < 10 ? 'success' : cvarNum > 20 ? 'danger' : 'primary'
                  return (
                    <HistoryRow
                      key={i}
                      ticker={a.ticker}
                      date={a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO') : '—'}
                      cvar={`${cvarNum.toFixed(1)}%`}
                      type={type}
                      verdict={action}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, color, delta, sub, featured = false }: {
  label: string; value: string; color: string; delta: string; sub: string; featured?: boolean
}) {
  return (
    <div className={cn(
      'bg-obsidian-low p-5 relative overflow-hidden transition-colors hover:bg-obsidian-mid',
      featured && 'border-t-2 border-primary'
    )}>
      <div className="font-mono text-[0.6rem] tracking-[0.14em] text-obsidian-on-var mb-2 uppercase">{label}</div>
      <div className={cn('font-display text-2xl font-bold leading-none mb-2', color)}>{value}</div>
      <div className="font-mono text-[0.62rem] text-obsidian-on-var">{delta}</div>
      <div className="font-mono text-[0.6rem] text-obsidian-outline mt-1 uppercase tracking-tight">{sub}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-4 h-0.5', color)} />
      <span className="font-mono text-[0.6rem] text-obsidian-on-var uppercase tracking-wider">{label}</span>
    </div>
  )
}

function VerdictCard({ ticker, action, color, text, confidence }: {
  ticker: string; action: VerdictAction; color: 'success' | 'danger' | 'primary'
  text: string; confidence?: number | null
}) {
  const borderColors = { success: 'border-l-success', danger: 'border-l-danger', primary: 'border-l-primary' }
  const badgeColors  = { success: 'bg-success/10 text-success', danger: 'bg-danger/10 text-danger', primary: 'bg-primary/10 text-primary' }
  const barColors    = { success: 'bg-success', danger: 'bg-danger', primary: 'bg-primary' }
  const pct = confidence != null ? Math.round(confidence * 100) : null
  return (
    <div className={cn(
      'p-3 bg-obsidian-mid border border-obsidian-outline-var border-l-3 hover:bg-obsidian-high transition-colors',
      borderColors[color]
    )}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <div className="font-mono text-[0.75rem] font-bold tracking-widest text-obsidian-on">{ticker}</div>
        <div className="text-[0.72rem] text-obsidian-on-var leading-snug line-clamp-2">{text}</div>
        <div className={cn('font-mono text-[0.58rem] font-bold px-2 py-0.5 tracking-tighter', badgeColors[color])}>
          {action}
        </div>
      </div>
      {pct != null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-[2px] bg-obsidian-outline-var rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', barColors[color])} style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[0.55rem] text-obsidian-outline shrink-0">{pct}% conf.</span>
        </div>
      )}
    </div>
  )
}

function HistoryRow({ ticker, date, cvar, type, verdict }: {
  ticker: string; date: string; cvar: string; type: 'success' | 'danger' | 'primary'; verdict: VerdictAction
}) {
  const cvarColors  = { success: 'text-success', danger: 'text-danger', primary: 'text-primary' }
  const badgeColors = { success: 'bg-success/10 text-success', danger: 'bg-danger/10 text-danger', primary: 'bg-primary/10 text-primary' }
  return (
    <tr className="hover:bg-obsidian-mid transition-colors">
      <td className="p-4 font-mono text-[0.68rem] text-obsidian-on font-bold">{ticker}</td>
      <td className="p-4 font-mono text-[0.68rem] text-obsidian-on-var">{date}</td>
      <td className={cn('p-4 font-mono text-[0.68rem] font-bold', cvarColors[type])}>{cvar}</td>
      <td className="p-4">
        <span className={cn('font-mono text-[0.58rem] font-bold px-2 py-0.5', badgeColors[type])}>
          {verdict}
        </span>
      </td>
    </tr>
  )
}

function cn(...inputs: (string | boolean | undefined)[]) {
  return inputs.filter(Boolean).join(' ')
}
