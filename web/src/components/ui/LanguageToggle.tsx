'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Language } from '@/lib/i18n/translations'
import { cn } from '@/lib/utils'

const LANGUAGES: Language[] = ['es', 'en']

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 border border-obsidian-outline-var bg-obsidian-low p-1',
        compact ? 'text-[0.56rem]' : 'text-[0.6rem]'
      )}
      aria-label={t('common.language')}
    >
      {LANGUAGES.map((option) => {
        const active = language === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            className={cn(
              'px-2.5 py-1 font-mono tracking-[0.16em] uppercase transition-colors',
              active
                ? 'bg-primary text-obsidian-bg'
                : 'text-obsidian-on-var hover:text-obsidian-on hover:bg-obsidian-mid'
            )}
            aria-pressed={active}
          >
            {t(`common.languageLabels.${option}`)}
          </button>
        )
      })}
    </div>
  )
}
