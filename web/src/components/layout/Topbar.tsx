'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function Topbar() {
  const supabase = createClient()
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()

    setDisplayName(profile?.display_name || user.email?.split('@')[0] || 'Operador')
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 32px',
        borderBottom: '1px solid #1a1a1c',
        background: '#0d0d0f',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ color: '#333', fontSize: '11px' }}>CLIMATE RISK TERMINAL</span>
        <span style={{ color: '#2a2a2a', fontSize: '11px' }}>|</span>
        <span style={{ color: '#444', fontSize: '11px' }}>stochasto.velveteen.app / dashboard</span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#131315',
            border: '1px solid #1a1a1c',
            padding: '6px 12px',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              background: '#f5c347',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '700',
              color: '#0d0d0f',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span>{displayName}</span>
        </div>

        <div
          style={{
            background: '#131315',
            border: '1px solid #1a1a1c',
            padding: '6px 12px',
            fontSize: '10px',
            color: '#444',
            letterSpacing: '1px',
          }}
        >
          MVP · v1.0.0
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            background: 'transparent',
            border: '1px solid #2a1a1a',
            color: '#ff6b6b',
            padding: '6px 14px',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '1px',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            opacity: loggingOut ? 0.5 : 1,
          }}
        >
          {loggingOut ? '...' : 'LOGOUT'}
        </button>
      </div>
    </div>
  )
}
