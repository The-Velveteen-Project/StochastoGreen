'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

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
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={cn('w-full', maxWidthClassName)}>
        <div className="mb-10 space-y-5">
          <div className="flex justify-end">
            <LanguageToggle />
          </div>

          <div className="text-center">
            <div className="font-mono text-[0.58rem] tracking-[0.18em] text-secondary uppercase mb-2">
              {t('shared.family')}
            </div>
            <div className="font-display text-xl font-bold text-obsidian-on leading-none">{title}</div>
            {subtitle && (
              <div className="font-mono text-[0.58rem] tracking-[0.14em] text-obsidian-on-var uppercase mt-2">
                {subtitle}
              </div>
            )}
          </div>
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
