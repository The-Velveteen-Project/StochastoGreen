"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, Cpu, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full z-10">
        <header className="flex justify-between items-center mb-16">
          <div className="font-display text-xl font-bold text-obsidian-on">
            Stochasto<span className="text-primary">Green</span>
          </div>
          <Link
            href="/dashboard"
            className="px-6 py-2 border border-primary/30 text-primary font-display text-xs font-bold tracking-widest hover:bg-primary/10 transition-all uppercase"
          >
            Acceder
          </Link>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="font-mono text-[0.62rem] tracking-[0.2em] text-obsidian-on-var mb-4 uppercase">
              // Merton Jump-Diffusion · NGFS Phase 4 · CVaR 95%
            </div>
            <h1 className="font-display text-5xl font-bold text-obsidian-on leading-[1.1] mb-6">
              Climate Transition<br />
              <span className="text-primary">Risk, Quantified.</span>
            </h1>
            <p className="text-obsidian-on-var text-[0.85rem] leading-relaxed mb-8 max-w-sm">
              Análisis estocástico avanzado mediante procesos de Salto-Difusión para la valoración
              de carteras ante la transición climática. 10 000 trayectorias Monte Carlo por activo.
            </p>

            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 bg-primary text-obsidian-bg font-display text-xs font-bold tracking-widest hover:bg-primary-dim transition-all shadow-[0_0_30px_rgba(245,195,71,0.2)]"
            >
              ABRIR TERMINAL
            </Link>

            <div className="grid grid-cols-2 gap-6 mt-12">
              <Feature icon={<ShieldCheck size={18} />} title="CVaR 95%" desc="Expected Shortfall" />
              <Feature icon={<TrendingUp size={18} />} title="SDE Engine" desc="Monte Carlo · N=10 000" />
              <Feature icon={<Cpu size={18} />} title="AI Agents" desc="Fundamental & Quant" />
              <Feature icon={<Globe size={18} />} title="NGFS Phase 4" desc="Disorderly Transition" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-2 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/10 blur-xl opacity-30" />
            <div className="relative border border-obsidian-outline-var bg-obsidian-low/40 backdrop-blur-md p-8 shadow-2xl space-y-5">
              {/* Schema preview — static, real structure */}
              <div className="font-mono text-[0.58rem] tracking-widest text-obsidian-on-var/60 mb-2">
                MODELO · MERTON JUMP-DIFFUSION
              </div>
              {[
                { label: 'CVaR 95%',      value: '–18.4%',  color: 'text-danger'  },
                { label: 'Jump λ',        value: '0.09',    color: 'text-warn'    },
                { label: 'Climate β',     value: '1.5×',    color: 'text-danger'  },
                { label: 'Veredicto',     value: 'VENDER',  color: 'text-danger'  },
                { label: 'Confianza',     value: '87%',     color: 'text-obsidian-on' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between border-b border-obsidian-outline-var/40 pb-3 last:border-0 last:pb-0">
                  <span className="font-mono text-[0.68rem] text-obsidian-on-var">{label}</span>
                  <span className={`font-mono text-[0.68rem] font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </main>

        <footer className="mt-24 border-t border-obsidian-outline-var pt-8 flex flex-col md:flex-row justify-between gap-4 opacity-50">
          <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-on-var">
            © 2026 THE VELVETEEN PROJECT
          </div>
          <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-on-var">
            NGFS PHASE 4 · MERTON JD · SEED 42
          </div>
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="text-primary mt-0.5">{icon}</div>
      <div>
        <div className="font-display text-[0.68rem] font-bold text-obsidian-on uppercase tracking-wider">{title}</div>
        <div className="font-mono text-[0.58rem] text-obsidian-on-var">{desc}</div>
      </div>
    </div>
  );
}
