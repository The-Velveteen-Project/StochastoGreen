'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthShell } from '@/components/layout/AuthShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function RegisterPage() {
  const router = useRouter()
  const { dictionary } = useLanguage()
  const { auth } = dictionary
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${location.origin}/dashboard`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Si email confirmation está desactivado en Supabase → redirige directo
    // Si está activado → muestra mensaje de confirmación
    setSuccess(true)
    setLoading(false)
    
    // Intentar redirigir de todas formas (funciona si no hay confirmación)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (success) {
    return (
      <AuthShell
        subtitle={auth.register.subtitle}
        eyebrow={auth.register.successEyebrow}
        footer={
          <div className="text-center font-mono text-[0.68rem] text-obsidian-on-var">
            {auth.register.successFooterLead}{' '}
            <Link href="/dashboard" className="text-primary hover:text-primary-dim transition-colors">
              {auth.register.successFooterLink}
            </Link>
            .
          </div>
        }
      >
        <div className="space-y-3 text-center">
          <div className="font-display text-lg font-bold text-obsidian-on">{auth.register.successTitle}</div>
          <div className="font-mono text-[0.72rem] text-obsidian-on-var">{auth.register.successBody}</div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      subtitle={auth.register.subtitle}
      eyebrow={auth.register.eyebrow}
      footer={
        <div className="text-center font-mono text-[0.68rem] text-obsidian-on-var">
          {auth.register.hasAccount}{' '}
          <Link href="/login" className="text-primary hover:text-primary-dim transition-colors">
            {auth.register.link}
          </Link>
        </div>
      }
    >
      <form onSubmit={handleRegister} className="space-y-5">
        <div>
          <label className="block font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
            {auth.register.name}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={auth.register.namePlaceholder}
            className="w-full bg-obsidian-mid border border-obsidian-outline-var px-3 py-2.5 font-mono text-[0.85rem] text-obsidian-on placeholder:text-obsidian-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
            {auth.register.email}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={auth.register.emailPlaceholder}
            className="w-full bg-obsidian-mid border border-obsidian-outline-var px-3 py-2.5 font-mono text-[0.85rem] text-obsidian-on placeholder:text-obsidian-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase mb-2">
            {auth.register.password} <span className="text-obsidian-outline">{auth.register.passwordHint}</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder={auth.register.passwordPlaceholder}
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
          {loading ? auth.register.submitting : auth.register.submit}
        </button>
      </form>
    </AuthShell>
  )
}
