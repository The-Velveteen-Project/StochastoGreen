'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function DocumentMetadataSync() {
  const pathname = usePathname()
  const { dictionary } = useLanguage()
  const { meta } = dictionary.shared

  useEffect(() => {
    const routeTitle =
      pathname === '/'
        ? meta.routes.landing
        : pathname?.startsWith('/login')
          ? meta.routes.login
          : pathname?.startsWith('/register')
            ? meta.routes.register
            : pathname?.startsWith('/onboarding')
              ? meta.routes.onboarding
              : pathname?.startsWith('/portfolio')
                ? meta.routes.portfolio
                : pathname?.startsWith('/history')
                  ? meta.routes.history
                  : pathname?.startsWith('/alerts')
                    ? meta.routes.alerts
                    : meta.routes.dashboard

    document.title = `${meta.titleBase} — ${routeTitle}`

    const description = document.querySelector('meta[name="description"]')
    if (description) {
      description.setAttribute('content', meta.description)
    }
  }, [meta, pathname])

  return null
}
