import type { Metadata } from "next";
import { cookies } from 'next/headers'
import { EmbeddedMode } from '@/components/EmbeddedMode'

export const metadata: Metadata = {
  title: "SOON · 題材工作台",
  description: "SOON 內部題材工作台，集中管理靈感、爆款分析與腳本前期資料。",
};

function NavBar({ creatorMode }: { creatorMode: boolean }) {
  return null

  const quickLinkStyle = {
    fontSize: '12px',
    color: 'var(--soon-text-secondary)',
    textDecoration: 'none',
    padding: '9px 12px',
    borderRadius: 'var(--soon-radius)',
    border: '0.5px solid var(--soon-border)',
    background: 'transparent',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  }

  return (
    <nav className="soon-hide-embedded" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'var(--bg-surface)',
      borderBottom: '0.5px solid var(--soon-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '60px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 10px',
          borderRadius: 'var(--soon-radius)',
          background: 'var(--soon-purple-dim)',
          border: '0.5px solid var(--border-default)',
          color: 'var(--soon-purple-light)',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          SOON
        </div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--soon-text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          Internal
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <a href="https://idea-brainstorm.vercel.app" style={{
          fontSize: '12px',
          color: '#fff',
          textDecoration: 'none',
          padding: '9px 12px',
          borderRadius: 'var(--soon-radius)',
          background: 'var(--soon-purple)',
          border: '0.5px solid var(--accent)',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          題材
        </a>
        <a href="https://script-generator-xi.vercel.app" style={quickLinkStyle}>
          劇本
        </a>
        <a href="https://soon-storyboard.vercel.app/storyboard" style={quickLinkStyle}>
          分鏡
        </a>
        <a href="https://soon-campaign-workspace-7kwt.vercel.app/strategy-library" style={quickLinkStyle}>
          策略
        </a>
        {creatorMode && (
          <a href="https://soon-creator-network.vercel.app/creator-workspace" style={{
            ...quickLinkStyle,
            padding: '9px 14px',
            background: 'var(--soon-surface2)',
            border: '0.5px solid var(--soon-border)',
          }}>
            Creator Dashboard
          </a>
        )}
      </div>
    </nav>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies()
  const creatorMode = cookieStore.get('soon_creator_mode')?.value === '1'

  return (
    <html lang="zh-HK">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/soon-design-system.css" />
      </head>
      <body style={{ margin: 0, padding: 0, background: 'var(--soon-bg)' }}>
        <EmbeddedMode />
        <NavBar creatorMode={creatorMode} />
        {children}
      </body>
    </html>
  );
}
