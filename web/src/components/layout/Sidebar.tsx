"use client";

import React, { useMemo } from 'react';
import { LayoutDashboard, Briefcase, History, Bell, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = useMemo(
    () => [
      { name: t('shared.nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
      { name: t('shared.nav.portfolio'), href: '/portfolio', icon: Briefcase },
      { name: t('shared.nav.history'), href: '/history', icon: History },
      { name: t('shared.nav.alerts'), href: '/alerts', icon: Bell },
    ],
    [t]
  );

  return (
    <aside className="sidebar">
      <div className="p-5 border-b border-obsidian-outline-var">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-secondary mb-1">
          {t('shared.family')}
        </div>
        <div className="font-display text-[0.95rem] font-bold text-obsidian-on leading-none">
          Stochasto<span className="text-primary">Green</span>
        </div>
        <div className="font-mono text-[0.58rem] tracking-[0.1em] text-obsidian-on-var mt-1">
          {t('shared.shellSubtitle')}
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
            </Link>
          );
        })}
        
        <Link
          href="https://cmorregof.github.io/velveteen/"
          target="_blank"
          className="mt-auto flex items-center gap-3 px-5 py-2.5 font-display text-[0.72rem] font-semibold tracking-wider text-obsidian-on-var border-l-2 border-transparent hover:text-obsidian-on hover:bg-obsidian-mid"
        >
          <ArrowLeft size={16} />
          <span>{t('shared.backToVelveteen')}</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-obsidian-outline-var space-y-2">
        <div className="font-mono text-[0.58rem] tracking-wider text-obsidian-outline flex items-center gap-2">
          <div className="w-[5px] h-[5px] rounded-full bg-primary" />
          {t('shared.status.engine')}
        </div>
        <div className="font-mono text-[0.58rem] tracking-wider text-obsidian-outline flex items-center gap-2">
          <div className="w-[5px] h-[5px] rounded-full bg-secondary/70" />
          {t('shared.status.feed')}
        </div>
      </div>
    </aside>
  );
}
