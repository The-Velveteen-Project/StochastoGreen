'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
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

  const inputClass =
    'w-full bg-obsidian-low border border-obsidian-outline-var text-obsidian-on px-3.5 py-3 text-[13px] font-mono outline-none transition-colors focus:border-primary/60'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian-bg font-mono px-6 py-12">
      <header className="mb-12 text-center">
        <div className="text-primary text-[10px] tracking-[0.32em] mb-2">
          THE VELVETEEN PROJECT
        </div>
        <div className="font-display text-[22px] font-bold text-obsidian-on tracking-wide">
          Stochasto<span className="text-primary">Green</span>
        </div>
        <div className="text-obsidian-outline text-[10px] tracking-[0.24em] mt-1">
          CLIMATE RISK TERMINAL
        </div>
      </header>

      <form
        onSubmit={handleLogin}
        className="w-full max-w-[400px] border border-obsidian-outline-var bg-obsidian-low p-8"
      >
        <div className="text-obsidian-on-var text-[10px] tracking-[0.24em] mb-8">
          // AUTENTICACIÓN
        </div>

        <div className="mb-5">
          <label className="block text-obsidian-outline text-[10px] tracking-[0.2em] mb-2">
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="usuario@empresa.com"
            className={inputClass}
          />
        </div>

        <div className="mb-7">
          <label className="block text-obsidian-outline text-[10px] tracking-[0.2em] mb-2">
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••••••"
            className={inputClass}
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger px-3.5 py-2.5 text-[11px] mb-5">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-obsidian-bg py-3.5 text-[12px] font-bold tracking-[0.24em] transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'AUTENTICANDO...' : 'INICIAR SESIÓN →'}
        </button>

        <div className="mt-6 text-center text-obsidian-outline text-[11px]">
          ¿Sin cuenta?{' '}
          <Link href="/register" className="text-primary hover:text-primary-dim">
            REGISTRARSE
          </Link>
        </div>
      </form>
    </div>
  )
}
