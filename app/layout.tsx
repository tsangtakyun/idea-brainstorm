import type { Metadata } from "next";
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: "SOON · 題材工作台",
  description: "SOON 內部題材工作台，集中管理靈感、爆款分析與腳本前期資料。",
};

function NavBar({ creatorMode }: { creatorMode: boolean }) {
  const quickLinkStyle = {
    fontSize: '12px',
    color: 'rgba(235,239,255,0.82)',
    textDecoration: 'none',
    padding: '9px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  }

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'linear-gradient(180deg, #21253f 0%, #1d2137 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '60px',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      boxShadow: '0 10px 24px rgba(4,6,15,0.28)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 10px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f8faff',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          SOON
        </div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8faff', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          Internal
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <a href="https://idea-brainstorm.vercel.app" style={{
          fontSize: '12px',
          color: '#f8faff',
          textDecoration: 'none',
          padding: '9px 12px',
          borderRadius: '12px',
          background: 'rgba(123,97,255,0.18)',
          border: '1px solid rgba(123,97,255,0.3)',
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
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
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
      <body style={{ margin: 0, padding: 0, paddingTop: '60px', background: '#15192c' }}>
        <NavBar creatorMode={creatorMode} />
        {children}
      </body>
    </html>
  );
}
