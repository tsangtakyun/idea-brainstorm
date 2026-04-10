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
      background: 'radial-gradient(circle at top right, rgba(123,97,255,0.16), transparent 28%), linear-gradient(180deg, #171b31 0%, #14182a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, Inter, ui-sans-serif, system-ui, sans-serif',
      color: '#f7f8fb',
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        width: '100%',
        maxWidth: '460px',
        padding: '42px 36px',
        borderRadius: '28px',
        background: 'linear-gradient(180deg, rgba(35,39,68,0.96), rgba(26,31,56,0.98))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 60px rgba(4,6,15,0.34)',
      }}>
        <p style={{ fontSize: '12px', letterSpacing: '0.16em', color: 'rgba(150,161,196,0.86)', marginBottom: '10px', textTransform: 'uppercase' }}>
          SOON Internal Workspace
        </p>
        <h1 style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: '42px', fontWeight: 500, lineHeight: 1.05, color: '#f7f8fb', marginBottom: '16px' }}>
          SOON 內部系統
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(211,218,242,0.82)', marginBottom: '34px', lineHeight: 1.75 }}>
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
            border: '1px solid rgba(123,97,255,0.28)',
            background: 'linear-gradient(135deg, #4b89ff, #7b61ff)',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'DM Sans, Inter, ui-sans-serif, system-ui, sans-serif',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            borderRadius: '16px',
            boxShadow: '0 12px 24px rgba(75,137,255,0.2)',
          }}
        >
          以 Google 帳號登入
        </button>

        <div style={{ marginTop: '18px', fontSize: '12px', color: 'rgba(150,161,196,0.78)' }}>
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
