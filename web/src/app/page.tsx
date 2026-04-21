"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TerminalLogs } from '@/components/ui/TerminalLogs';
import { ShieldCheck, TrendingUp, Cpu, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Element */}
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
            Terminal Dashboard
          </Link>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="font-mono text-[0.62rem] tracking-[0.2em] text-secondary mb-4 uppercase">
              // Risk Management Interface v1.0
            </div>
            <h1 className="font-display text-5xl font-bold text-obsidian-on leading-[1.1] mb-6">
              Climate Risk <br />
              <span className="text-primary font-extrabold uppercase italic tracking-tighter">Quantified.</span>
            </h1>
            <p className="text-obsidian-on-var text-[0.85rem] leading-relaxed mb-8 max-w-sm">
              Análisis estocástico avanzado mediante procesos de Salto-Difusión (Merton Jump-Diffusion) para la valoración de carteras ante la transición climática.
            </p>
            
            <div className="flex gap-4">
              <Link href="/dashboard" className="px-8 py-3 bg-primary text-obsidian-bg font-display text-xs font-bold tracking-widest hover:bg-primary-dim transition-all shadow-[0_0_30px_rgba(245,195,71,0.2)]">
                EXPLORAR TERMINAL
              </Link>
              <button className="px-8 py-3 bg-transparent border border-obsidian-outline text-obsidian-on font-display text-xs font-bold tracking-widest hover:bg-obsidian-mid transition-all">
                WHITEBOARD
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mt-12">
              <Feature icon={<ShieldCheck size={18} />} title="VaR & CVaR" desc="95% Expected Shortfall" />
              <Feature icon={<TrendingUp size={18} />} title="SDE Engine" desc="Monte Carlo Simulation" />
              <Feature icon={<Cpu size={18} />} title="AI Agents" desc="Fundamental & Quant" />
              <Feature icon={<Globe size={18} />} title="NGFS Sync" desc="Global Climate Scenarios" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-2 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/10 blur-xl opacity-30" />
            <div className="relative border border-obsidian-outline-var bg-obsidian-low/40 backdrop-blur-md p-1 shadow-2xl">
              <div className="bg-obsidian-low border border-obsidian-outline-var/50 p-1">
                <TerminalLogs />
              </div>
            </div>
            
            <div className="absolute -bottom-6 -right-6 p-4 bg-obsidian-mid border border-obsidian-outline-var font-mono text-[0.55rem] space-y-1">
              <div className="text-secondary opacity-60">KOU MODEL</div>
              <div className="text-obsidian-on">MU | SIGMA | LAMBDA</div>
              <div className="text-primary">PARAMETERS: CONFIGURABLE</div>
            </div>
          </motion.div>
        </main>
        
        <footer className="mt-24 border-t border-obsidian-outline-var pt-8 flex flex-col md:flex-row justify-between gap-4 opacity-50">
          <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-on-var">
            © 2026 The Velveteen Project // StochastoGreen
	          </div>
	          <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-on-var">
	            MODEL: KOU JUMP-DIFFUSION // METRICS: VAR 95% / CVaR 95%
	          </div>
	        </footer>
	      </div>
	    </div>
	  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
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
