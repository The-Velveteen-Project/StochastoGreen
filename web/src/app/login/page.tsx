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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#131315',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <div style={{ color: '#f5c347', fontSize: '11px', letterSpacing: '4px', marginBottom: '8px' }}>
          THE VELVETEEN PROJECT
        </div>
        <div style={{ color: '#57f1db', fontSize: '22px', fontWeight: '700', letterSpacing: '2px' }}>
          STOCHASTO_GREEN
        </div>
        <div style={{ color: '#444', fontSize: '10px', letterSpacing: '3px', marginTop: '4px' }}>
          CLIMATE RISK TERMINAL v1.0
        </div>
      </div>

      {/* Card */}
      <form onSubmit={handleLogin} style={{
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #222',
        background: '#0d0d0f',
        padding: '32px',
      }}>
        <div style={{ color: '#57f1db', fontSize: '11px', letterSpacing: '3px', marginBottom: '32px' }}>
          // AUTENTICACIÓN
        </div>

        {/* Email */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#555', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
            EMAIL_ADDRESS
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="usuario@empresa.com"
            style={{
              width: '100%',
              background: '#131315',
              border: '1px solid #2a2a2a',
              color: '#e0e0e0',
              padding: '12px 14px',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', color: '#555', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••••••"
            style={{
              width: '100%',
              background: '#131315',
              border: '1px solid #2a2a2a',
              color: '#e0e0e0',
              padding: '12px 14px',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#1a0a0a',
            border: '1px solid #5a1a1a',
            color: '#ff6b6b',
            padding: '10px 14px',
            fontSize: '11px',
            marginBottom: '20px',
          }}>
            ✗ {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#1a2a28' : '#57f1db',
            color: loading ? '#57f1db' : '#0d0d0f',
            border: 'none',
            padding: '14px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '3px',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'AUTENTICANDO...' : 'INICIAR_SESIÓN →'}
        </button>

        {/* Footer link */}
        <div style={{ marginTop: '24px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
          ¿Sin cuenta?{' '}
          <Link href="/register" style={{ color: '#57f1db', textDecoration: 'none' }}>
            REGISTRARSE
          </Link>
        </div>
      </form>

      {/* Bottom label */}
      <div style={{ marginTop: '32px', color: '#2a2a2a', fontSize: '10px', letterSpacing: '2px' }}>
        LATENCY: 12ms // NGFS_ORDERLY_2050
      </div>
    </div>
  )
}
