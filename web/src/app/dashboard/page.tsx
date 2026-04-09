"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  ComposedChart, Bar, Cell
} from 'recharts';
import { TrendingDown, TrendingUp, AlertTriangle, Layers, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- MOCK DATA ---
const SIMULATION_DATA = Array.from({ length: 50 }, (_, i) => ({
  time: i,
  median: 100 + i * 0.5 + Math.sin(i * 0.3) * 2,
  p5: 100 + i * 0.2 - i * 0.5 - Math.random() * 5,
  p95: 100 + i * 0.8 + Math.random() * 8,
  jump: i === 25 ? 85 : null
}));

const TICKER_RISK = [
  { name: 'MSFT', cvar: 5.5, level: 'low', color: '#4ade80' },
  { name: 'TSLA', cvar: 14.2, level: 'medium', color: '#f5c347' },
  { name: 'XOM', cvar: 28.4, level: 'high', color: '#ff6b6b' },
];

const ESG_DATA = [
  { name: 'Verdes', value: 33, color: '#4ade80' },
  { name: 'En Transición', value: 33, color: '#f5c347' },
  { name: 'Brown Assets', value: 33, color: '#ff6b6b' },
];

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalyses() {
      const { data, error } = await supabase
        .from('risk_analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setAnalyses(data);
      }
      setLoading(false);
    }
    fetchAnalyses();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'risk_analyses' }, (payload) => {
        setAnalyses((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const lastAnalysis = analyses[0] || {};
  
  // Calculate aggregate stats or use last
  const portfolioCVar = lastAnalysis.cvar_95 ? `${lastAnalysis.cvar_95}%` : "0.0%";
  const probShock = lastAnalysis.jump_prob ? `${lastAnalysis.jump_prob}%` : "0.0%";

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4">
        <div className="font-mono text-[0.62rem] tracking-[0.14em] text-primary uppercase whitespace-nowrap">
          Visión General del Portafolio
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-obsidian-outline-var to-transparent" />
      </section>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KPICard 
          label="CVAR 95% — ÚLTIMO ANÁLISIS" 
          value={portfolioCVar} 
          color="text-primary" 
          delta={lastAnalysis.ticker || "Pendiente"} 
          sub="PEOR 5% ESCENARIOS"
          featured
        />
        <KPICard 
          label="RETORNO ESPERADO — 6M" 
          value="+8.3%" 
          color="text-success" 
          delta="▲ Percentil 50" 
          sub="AJUSTADO POR RIESGO"
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
          value={analyses.length.toString()} 
          color="text-obsidian-on" 
          delta={analyses.slice(0, 3).map(a => a.ticker).join(' · ')} 
          sub="HISTORIAL ACTIVO"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monte Carlo Simulation */}
        <div className="lg:col-span-2 panel">
          <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center bg-obsidian-low">
            <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Monte Carlo Simulation</h3>
            <span className="font-mono text-[0.58rem] text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 tracking-wider">
              10k paths · Jump-diffusion
            </span>
          </div>
          <div className="h-[300px] w-full p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SIMULATION_DATA}>
                <defs>
                  <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f5c347" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f5c347" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a282c" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #4a484c', fontSize: '12px' }}
                  itemStyle={{ color: '#e8e4e7' }}
                />
                <Area type="monotone" dataKey="p95" stroke="none" fill="#4ade80" fillOpacity={0.05} />
                <Area type="monotone" dataKey="p5" stroke="none" fill="#ff6b6b" fillOpacity={0.05} />
                <Line type="monotone" dataKey="median" stroke="#f5c347" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="p-4 border-t border-obsidian-outline-var flex gap-6">
             <LegendItem color="bg-primary" label="Trayectoria media" />
             <LegendItem color="bg-danger" label="Zona CVaR (peor 5%)" />
             <LegendItem color="bg-success" label="Escenario optimista" />
          </div>
        </div>

        {/* Right Column: Risk & ESG */}
        <div className="space-y-6">
          <div className="panel">
            <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
              <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">CVAR Por Activo</h3>
              <span className="text-[0.58rem] font-mono text-primary">95% ES</span>
            </div>
            <div className="p-5 space-y-4">
              {TICKER_RISK.map(ticker => (
                <div key={ticker.name} className="space-y-1.5">
                  <div className="flex justify-between text-[0.68rem] font-mono">
                    <span className="text-obsidian-on">{ticker.name}</span>
                    <span style={{ color: ticker.color }}>{ticker.cvar}%</span>
                  </div>
                  <div className="h-1.5 bg-obsidian-high w-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(ticker.cvar / 30) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full"
                      style={{ backgroundColor: ticker.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
              <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Clasificación ESG</h3>
              <span className="text-[0.58rem] font-mono text-primary">CLIMATE BETA</span>
            </div>
            <div className="p-5 space-y-3">
              {ESG_DATA.map(item => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5" style={{ backgroundColor: item.color }} />
                  <span className="text-[0.78rem] text-obsidian-on-var flex-1">{item.name}</span>
                  <span className="text-[0.68rem] font-mono text-obsidian-on">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="panel">
           <div className="p-4 border-b border-obsidian-outline-var flex justify-between items-center">
              <h3 className="font-display text-[0.72rem] font-bold tracking-widest uppercase">Veredictos Ejecutivos</h3>
              <span className="text-[0.58rem] font-mono text-primary">AGENTE IA</span>
            </div>
            <div className="p-4 space-y-3">
              {analyses.slice(0, 3).map((a, i) => (
                <VerdictCard 
                  key={i}
                  ticker={a.ticker} 
                  action={a.verdict?.includes('COMPRAR') ? 'COMPRAR' : a.verdict?.includes('VENDER') ? 'VENDER' : 'MANTENER'} 
                  color={a.cvar_95 < 10 ? 'success' : a.cvar_95 > 20 ? 'danger' : 'primary'} 
                  text={a.verdict?.split('.')[0] + '.'} 
                />
              ))}
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
              <span className="text-[0.58rem] font-mono text-primary">SUPABASE</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-obsidian-outline-var">
                    <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Ticker</th>
                    <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Fecha</th>
                    <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">CVAR 95%</th>
                    <th className="p-4 font-mono text-[0.58rem] text-obsidian-outline tracking-wider uppercase">Veredicto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-outline-var/30">
                  {analyses.map((a, i) => (
                    <HistoryRow 
                      key={i}
                      ticker={a.ticker} 
                      date={a.created_at ? new Date(a.created_at).toLocaleDateString() : 'N/A'} 
                      cvar={`${a.cvar_95}%`} 
                      type={a.cvar_95 < 10 ? 'success' : a.cvar_95 > 20 ? 'danger' : 'primary'} 
                      verdict={a.verdict?.match(/\[(.*?)\]/)?.[1] || 'ANALIZADO'} 
                    />
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, color, delta, sub, featured = false }: any) {
  return (
    <div className={cn("bg-obsidian-low p-5 relative overflow-hidden transition-colors hover:bg-obsidian-mid", featured && "border-t-2 border-primary")}>
      <div className="font-mono text-[0.6rem] tracking-[0.14em] text-obsidian-on-var mb-2 uppercase">{label}</div>
      <div className={cn("font-display text-2xl font-bold leading-none mb-2", color)}>{value}</div>
      <div className={cn("font-mono text-[0.62rem] flex items-center gap-1.5", delta.includes('▼') || delta.includes('Pérdida') ? 'text-primary' : delta.includes('▲') ? 'text-success' : 'text-obsidian-on-var')}>
        {delta}
      </div>
      <div className="font-mono text-[0.6rem] text-obsidian-outline mt-1 uppercase tracking-tight">{sub}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-4 h-0.5", color)} />
      <span className="font-mono text-[0.6rem] text-obsidian-on-var uppercase tracking-wider">{label}</span>
    </div>
  );
}

function VerdictCard({ ticker, action, color, text }: any) {
  const borderColors: any = { success: 'border-l-success', danger: 'border-l-danger', primary: 'border-l-primary' };
  const badgeColors: any = { success: 'bg-success/10 text-success', danger: 'bg-danger/10 text-danger', primary: 'bg-primary/10 text-primary' };
  
  return (
    <div className={cn("p-3 bg-obsidian-mid border border-obsidian-outline-var border-l-3 grid grid-cols-[auto_1fr_auto] items-center gap-4 hover:bg-obsidian-high transition-colors", borderColors[color])}>
      <div className="font-mono text-[0.75rem] font-bold tracking-widest text-obsidian-on">{ticker}</div>
      <div className="text-[0.72rem] text-obsidian-on-var leading-snug">{text}</div>
      <div className={cn("font-mono text-[0.58rem] font-bold px-2 py-0.5 tracking-tighter", badgeColors[color])}>{action}</div>
    </div>
  );
}

function HistoryRow({ ticker, date, cvar, type, verdict }: any) {
  const cvarColors: any = { success: 'text-success', danger: 'text-danger', primary: 'text-primary' };
  const badgeColors: any = { success: 'bg-success/10 text-success', danger: 'bg-danger/10 text-danger', primary: 'bg-primary/10 text-primary' };

  return (
    <tr className="hover:bg-obsidian-mid transition-colors">
      <td className="p-4 font-mono text-[0.68rem] text-obsidian-on font-bold">{ticker}</td>
      <td className="p-4 font-mono text-[0.68rem] text-obsidian-on-var">{date}</td>
      <td className={cn("p-4 font-mono text-[0.68rem] font-bold", cvarColors[type])}>{cvar}</td>
      <td className="p-4">
        <span className={cn("font-mono text-[0.58rem] font-bold px-2 py-0.5", badgeColors[type])}>{verdict}</span>
      </td>
    </tr>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
