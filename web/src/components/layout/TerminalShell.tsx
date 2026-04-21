'use client'

import React from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { cn } from '@/lib/utils'

export function TerminalShell({
  children,
  contentClassName,
}: {
  children: React.ReactNode
  contentClassName?: string
}) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className={cn('p-8', contentClassName)}>{children}</div>
      </main>
    </div>
  )
}

