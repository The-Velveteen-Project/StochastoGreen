'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export function AuthShell({
  title = (
    <>
      Stochasto<span className="text-primary">Green</span>
    </>
  ),
  subtitle,
  eyebrow,
  children,
  footer,
  maxWidthClassName = 'max-w-md',
}: {
  title?: React.ReactNode
  subtitle?: string
  eyebrow?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidthClassName?: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={cn('w-full', maxWidthClassName)}>
        <div className="text-center mb-10">
          <div className="font-mono text-[0.58rem] tracking-[0.18em] text-secondary uppercase mb-2">
            // The Velveteen Project
          </div>
          <div className="font-display text-xl font-bold text-obsidian-on leading-none">{title}</div>
          {subtitle && (
            <div className="font-mono text-[0.58rem] tracking-[0.14em] text-obsidian-on-var uppercase mt-2">
              {subtitle}
            </div>
          )}
        </div>

        <div className="panel p-8">
          {eyebrow && (
            <div className="font-mono text-[0.58rem] tracking-[0.18em] text-primary uppercase mb-7">
              {eyebrow}
            </div>
          )}
          {children}
        </div>

        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  )
}
