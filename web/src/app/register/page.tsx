'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
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
      <div style={{
        minHeight: '100vh',
        background: '#131315',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'center',
        padding: '24px',
      }}>
        <div style={{ color: '#57f1db', fontSize: '32px', marginBottom: '16px' }}>✓</div>
        <div style={{ color: '#57f1db', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px' }}>
          CUENTA CREADA
        </div>
        <div style={{ color: '#555', fontSize: '11px' }}>
          Redirigiendo al dashboard...
        </div>
      </div>
    )
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
          NUEVO OPERADOR
        </div>
      </div>

      {/* Card */}
      <form onSubmit={handleRegister} style={{
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #222',
        background: '#0d0d0f',
        padding: '32px',
      }}>
        <div style={{ color: '#57f1db', fontSize: '11px', letterSpacing: '3px', marginBottom: '32px' }}>
          // REGISTRO
        </div>

        {/* Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#555', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
            NOMBRE
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Carlos M."
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
            PASSWORD (mín. 8 caracteres)
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
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
            background: loading ? '#1a2a28' : '#f5c347',
            color: '#0d0d0f',
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
          {loading ? 'CREANDO CUENTA...' : 'REGISTRARSE →'}
        </button>

        {/* Footer link */}
        <div style={{ marginTop: '24px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" style={{ color: '#57f1db', textDecoration: 'none' }}>
            INICIAR_SESIÓN
          </Link>
        </div>
      </form>
    </div>
  )
}
