"use client";

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function TerminalLogs() {
  const { dictionary } = useLanguage()
  const preview = dictionary.landing.preview

  return (
    <div className="bg-black/40 border border-obsidian-outline-var p-4 font-mono text-[0.65rem] h-[200px] flex flex-col overflow-hidden backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-3 border-b border-obsidian-outline-var/30 pb-2">
        <div className="w-2 h-2 rounded-full bg-danger/50" />
        <div className="w-2 h-2 rounded-full bg-warn/50" />
        <div className="w-2 h-2 rounded-full bg-success/50" />
        <span className="ml-2 text-obsidian-outline opacity-70 uppercase tracking-widest">{preview.fileName}</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 text-obsidian-on-var">
        {preview.logs.map((log) => (
          <div key={log} className={log.includes('[STATUS]') ? 'text-primary' : 'text-obsidian-on-var'}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
