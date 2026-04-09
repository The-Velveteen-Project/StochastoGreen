"use client";

import React from 'react';
import { LayoutDashboard, Briefcase, History, Bell, ArrowLeft, Terminal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
  { name: 'PORTAFOLIO', href: '/portfolio', icon: Briefcase },
  { name: 'HISTORIAL', href: '/history', icon: History },
  { name: 'ALERTAS', href: '/alerts', icon: Bell, badge: '2' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="p-5 border-b border-obsidian-outline-var">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-secondary mb-1">
          // THE VELVETEEN PROJECT
        </div>
        <div className="font-display text-[0.95rem] font-bold text-obsidian-on leading-none">
          Stochasto<span className="text-primary">Green</span>
        </div>
        <div className="font-mono text-[0.58rem] tracking-[0.1em] text-obsidian-on-var mt-1">
          CLIMATE RISK TERMINAL v1.0
        </div>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-[0.15rem]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 font-display text-[0.72rem] font-semibold tracking-wider transition-all border-l-2",
                isActive 
                  ? "text-primary border-primary bg-primary/5" 
                  : "text-obsidian-on-var border-transparent hover:text-obsidian-on hover:bg-obsidian-mid"
              )}
            >
              <item.icon size={16} className={cn("shrink-0", isActive ? "text-primary" : "text-obsidian-on-var")} />
              <span>{item.name}</span>
              {item.badge && (
                <span className="ml-auto bg-danger text-white text-[0.5rem] px-1.5 py-0.5 font-mono">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
        
        <Link
          href="https://cmorregof.github.io/velveteen/"
          target="_blank"
          className="mt-auto flex items-center gap-3 px-5 py-2.5 font-display text-[0.72rem] font-semibold tracking-wider text-obsidian-on-var border-l-2 border-transparent hover:text-obsidian-on hover:bg-obsidian-mid"
        >
          <ArrowLeft size={16} />
          <span>VELVETEEN.AI</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-obsidian-outline-var space-y-2">
        <div className="font-mono text-[0.58rem] tracking-wider text-obsidian-outline flex items-center gap-2">
          <div className="w-[5px] h-[5px] rounded-full bg-success animate-pulse" />
          SDE_ENGINE · ONLINE
        </div>
        <div className="font-mono text-[0.58rem] tracking-wider text-obsidian-outline flex items-center gap-2">
          <div className="w-[5px] h-[5px] rounded-full bg-primary animate-pulse" />
          ALPHAVANTAGE · 25 REQ/DAY
        </div>
      </div>
    </aside>
  );
}
