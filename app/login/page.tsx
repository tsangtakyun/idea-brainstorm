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
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      color: 'var(--text-primary)',
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        width: '100%',
        maxWidth: '460px',
        padding: '42px 36px',
        borderRadius: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 24px 60px rgba(4,6,15,0.34)',
      }}>
        <p style={{ fontSize: '12px', letterSpacing: '0.16em', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 500 }}>
          SOON Internal Workspace
        </p>
        <h1 style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: '34px', fontWeight: 600, lineHeight: 1.05, color: 'var(--text-primary)', marginBottom: '16px' }}>
          SOON 內部系統
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '34px', lineHeight: 1.75 }}>
          進入題材工作台、劇本生成、分鏡規劃與策略資料庫，將前期研究與內容規劃集中在同一套內部系統中處理。
        </p>

        {error === 'unauthorized' && (
          <p style={{ color: '#ff9f8f', marginBottom: '24px', fontSize: '14px', background: 'rgba(255,95,95,0.08)', border: '1px solid rgba(255,159,143,0.18)', borderRadius: '16px', padding: '12px 14px' }}>
            你的帳號未獲授權，請聯絡管理員。
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '15px 24px',
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            borderRadius: '8px',
            boxShadow: 'none',
          }}
        >
          以 Google 帳號登入
        </button>

        <div style={{ marginTop: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>
          登入後仍可從右上角快速跳往題材、劇本、分鏡與策略模組。
        </div>
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
