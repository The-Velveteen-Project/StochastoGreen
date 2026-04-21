'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Language, TranslationTree, languageStorageKey, translations } from './translations'

type LanguageContextValue = {
  language: Language
  locale: string
  dictionary: TranslationTree
  setLanguage: (language: Language) => void
  t: (path: string) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function getTranslation(path: string, source: TranslationTree): string {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, source)

  return typeof value === 'string' ? value : path
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es')

  useEffect(() => {
    const saved = window.localStorage.getItem(languageStorageKey)
    if (saved === 'es' || saved === 'en') {
      const frame = window.setTimeout(() => {
        setLanguageState(saved)
      }, 0)

      return () => window.clearTimeout(frame)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = translations[language]
    const locale = language === 'es' ? 'es-CO' : 'en-US'

    return {
      language,
      locale,
      dictionary,
      setLanguage: setLanguageState,
      t: (path: string) => getTranslation(path, dictionary),
    }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }

  return context
}
