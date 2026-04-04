'use client'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F5F2EC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'EB Garamond, serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '48px' }}>
        <p style={{ fontSize: '13px', letterSpacing: '0.15em', color: '#888', marginBottom: '8px' }}>
          SOON · AI Media Content Creation
        </p>
        <h1 style={{ fontSize: '32px', fontWeight: '400', color: '#1a1a1a', marginBottom: '48px' }}>
          BBO 內部系統
        </h1>

        {error === 'unauthorized' && (
          <p style={{ color: '#c0392b', marginBottom: '24px', fontSize: '14px' }}>
            你的帳號未獲授權，請聯絡管理員。
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '14px 24px',
            border: '1px solid #1a1a1a',
            backgroundColor: 'transparent',
            color: '#1a1a1a',
            fontSize: '15px',
            fontFamily: 'EB Garamond, serif',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          以 Google 帳號登入
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
