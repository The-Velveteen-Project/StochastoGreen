"use client";

import React from 'react';

const PREVIEW_LOGS = [
  "[MODE] CLIMATE RISK TERMINAL",
  "[MODEL] KOU JUMP-DIFFUSION",
  "[SIM] MONTE CARLO (10,000 PATHS)",
  "[SCENARIO] NGFS (ORDERLY)",
  "[METRIC] VAR 95% / CVAR 95%",
  "[OUTPUT] TAIL RISK BANDS + VERDICTS",
  "[STATUS] AWAITING OPERATOR INPUT",
];

export function TerminalLogs() {
  return (
    <div className="bg-black/40 border border-obsidian-outline-var p-4 font-mono text-[0.65rem] h-[200px] flex flex-col overflow-hidden backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-3 border-b border-obsidian-outline-var/30 pb-2">
        <div className="w-2 h-2 rounded-full bg-danger/50" />
        <div className="w-2 h-2 rounded-full bg-warn/50" />
        <div className="w-2 h-2 rounded-full bg-success/50" />
        <span className="ml-2 text-obsidian-outline opacity-70 uppercase tracking-widest">Terminal_Preview.txt</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 text-obsidian-on-var">
        {PREVIEW_LOGS.map((log) => (
          <div key={log} className={log.includes('[STATUS]') ? 'text-primary' : 'text-obsidian-on-var'}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
