'use client'

import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { DocumentMetadataSync } from '@/components/providers/DocumentMetadataSync'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <DocumentMetadataSync />
      {children}
    </LanguageProvider>
  )
}
