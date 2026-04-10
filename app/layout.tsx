import type { Metadata } from "next";
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: "SOON · 題材工作台",
  description: "SOON 內部題材工作台，集中管理靈感、爆款分析與腳本前期資料。",
};

function NavBar({ creatorMode }: { creatorMode: boolean }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#ff5d36', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#7b61ff', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#3b82f6', display: 'inline-block' }} />
        </div>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8faff', letterSpacing: '-0.02em' }}>
          SOON 內部工作台
        </span>
      </div>

      {creatorMode ? (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a href="https://soon-creator-network.vercel.app/creator-workspace" style={{
            fontSize: '13px',
            color: '#f8faff',
            textDecoration: 'none',
            padding: '10px 16px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            letterSpacing: '0.01em',
          }}>
            返回 Creator Dashboard
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a href="https://idea-brainstorm.vercel.app" style={{
            fontSize: '13px',
            color: '#f8faff',
            textDecoration: 'none',
            padding: '10px 14px',
            borderRadius: '14px',
            background: 'rgba(123,97,255,0.18)',
            border: '1px solid rgba(123,97,255,0.3)',
            letterSpacing: '0.01em',
          }}>
            題材工作台
          </a>
          <a href="https://script-generator-xi.vercel.app" style={{
            fontSize: '13px',
            color: 'rgba(235,239,255,0.76)',
            textDecoration: 'none',
            padding: '10px 14px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            letterSpacing: '0.01em',
          }}>
            劇本生成
          </a>
          <a href="https://soon-storyboard.vercel.app/storyboard" style={{
            fontSize: '13px',
            color: 'rgba(235,239,255,0.76)',
            textDecoration: 'none',
            padding: '10px 14px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            letterSpacing: '0.01em',
          }}>
            分鏡指引
          </a>
          <a href="https://soon-campaign-workspace-7kwt.vercel.app/strategy-library" style={{
            fontSize: '13px',
            color: 'rgba(235,239,255,0.76)',
            textDecoration: 'none',
            padding: '10px 14px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            letterSpacing: '0.01em',
          }}>
            策略資料庫
          </a>
        </div>
      )}
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
