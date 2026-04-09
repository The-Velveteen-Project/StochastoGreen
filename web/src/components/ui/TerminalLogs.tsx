"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_LOGS = [
  "[SYSTEM] INITIALIZING SDE ENGINE v2.4...",
  "[OK] CONNECTED TO NGFS CLIMATE DATASET",
  "[INF] FETCHING BLOOMBERG ESG METRICS...",
  "[CALC] CALIBRATING KOU JUMP-DIFFUSION...",
  "[SIM] STARTING MONTE CARLO (10,000 PATHS)",
  "[WARN] HIGH CLIMATE BETA DETECTED IN ENERGY SECTOR",
  "[CALC] UPDATING TAIL RISK ESTIMATES (VAR 95%)",
  "[OK] ORCHESTRATOR SYNC COMPLETED",
  "[SYSTEM] WAITING FOR USER INPUT..."
];

export function TerminalLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < MOCK_LOGS.length) {
        setLogs(prev => [...prev, MOCK_LOGS[index]]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black/40 border border-obsidian-outline-var p-4 font-mono text-[0.65rem] h-[200px] flex flex-col overflow-hidden backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-3 border-b border-obsidian-outline-var/30 pb-2">
        <div className="w-2 h-2 rounded-full bg-danger/50" />
        <div className="w-2 h-2 rounded-full bg-warn/50" />
        <div className="w-2 h-2 rounded-full bg-success/50" />
        <span className="ml-2 text-obsidian-outline opacity-70 uppercase tracking-widest">SDE_Engine_Monitor.sh</span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        <AnimatePresence>
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className={log.includes('[OK]') ? "text-success" : log.includes('[WARN]') ? "text-warn" : "text-obsidian-on-var"}
            >
              <span className="text-obsidian-outline mr-2">[{new Date().toLocaleTimeString('es-ES', { hour12: false })}]</span>
              {log}
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.div
          animate={{ opacity: [0, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-1.5 h-3 bg-primary ml-1"
        />
      </div>
    </div>
  );
}
