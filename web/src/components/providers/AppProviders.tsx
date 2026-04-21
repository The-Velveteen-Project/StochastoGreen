'use client'

import { LanguageProvider } from '@/lib/i18n/LanguageContext'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
