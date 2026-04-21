'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthShell } from '@/components/layout/AuthShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LoginPage() {
  const router = useRouter()
  const { dictionary } = useLanguage()
  const { auth } = dictionary
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthShell
      subtitle={auth.login.subtitle}
      eyebrow={auth.login.eyebrow}
      footer={
        <div className="text-center font-mono text-[0.68rem] text-obsidian-on-var">
          {auth.login.noAccount}{' '}
          <Link href="/register" className="text-primary hover:text-primary-dim transition-colors">
            {auth.login.link}
          </Link>
        </div>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
            {auth.login.email}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={auth.login.emailPlaceholder}
            className="w-full bg-obsidian-mid border border-obsidian-outline-var px-3 py-2.5 font-mono text-[0.85rem] text-obsidian-on placeholder:text-obsidian-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
            {auth.login.password}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={auth.login.passwordPlaceholder}
            className="w-full bg-obsidian-mid border border-obsidian-outline-var px-3 py-2.5 font-mono text-[0.85rem] text-obsidian-on placeholder:text-obsidian-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger px-3 py-2.5 font-mono text-[0.72rem]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-obsidian-bg font-display text-[0.72rem] font-bold tracking-[0.18em] uppercase py-3 hover:bg-primary-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? auth.login.submitting : auth.login.submit}
        </button>
      </form>
    </AuthShell>
  )
}
