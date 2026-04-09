"use client";

import React from 'react';

export function Topbar() {
  return (
    <header className="topbar">
      <div className="font-display text-[0.78rem] font-semibold tracking-wider text-obsidian-on-var">
        CLIMATE RISK TERMINAL
      </div>
      <div className="w-[1px] h-[18px] bg-obsidian-outline-var" />
      <div className="font-mono text-[0.65rem] text-primary tracking-wider">
        stochasto.velveteen.app / dashboard
      </div>
      
      <div className="ml-auto flex items-center gap-4">
        <div className="font-mono text-[0.6rem] tracking-widest px-2.5 py-0.8 bg-primary/10 border border-primary/20 text-primary uppercase">
          MVP · v1.0.0
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-obsidian-high border border-obsidian-outline-var cursor-pointer hover:bg-obsidian-bright transition-colors">
          <div className="w-5.5 h-5.5 rounded-full bg-primary flex items-center justify-center text-[0.55rem] font-bold text-obsidian-bg">
            CM
          </div>
          <div className="font-display text-[0.68rem] font-semibold">
            Carlos M.
          </div>
        </div>
      </div>
    </header>
  );
}
