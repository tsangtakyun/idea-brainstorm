import type { Metadata } from "next";
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: "SOON · Idea Collection",
  description: "AI-powered idea brainstorm collection by SOON",
};

function NavBar({ creatorMode }: { creatorMode: boolean }) {
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: '#F5F2EC',
      borderBottom: '1px solid #e0ddd6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      height: '52px',
      fontFamily: 'EB Garamond, serif',
    }}>
      <span style={{ fontSize: '13px', letterSpacing: '0.15em', color: '#888' }}>
        SOON
      </span>
      {creatorMode ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a href="https://soon-creator-network.vercel.app/creator-workspace" style={{
            fontSize: '13px',
            color: '#1a1a1a',
            textDecoration: 'none',
            padding: '6px 14px',
            borderBottom: '1px solid #1a1a1a',
            letterSpacing: '0.03em',
          }}>
            返回 Creator Dashboard
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a href="https://idea-brainstorm.vercel.app" style={{
            fontSize: '13px',
            color: '#1a1a1a',
            textDecoration: 'none',
            padding: '6px 14px',
            borderBottom: '1px solid #1a1a1a',
            letterSpacing: '0.03em',
          }}>
            💡 題材庫 Idea Collection
          </a>
          <a href="https://script-generator-xi.vercel.app" style={{
            fontSize: '13px',
            color: '#888',
            textDecoration: 'none',
            padding: '6px 14px',
            letterSpacing: '0.03em',
          }}>
            📝 劇本生成 Script Generator
          </a>
          <a href="https://soon-storyboard.vercel.app/storyboard" style={{
            fontSize: '13px',
            color: '#888',
            textDecoration: 'none',
            padding: '6px 14px',
            letterSpacing: '0.03em',
          }}>
            🎬 分鏡指引 Shooting Guideline
          </a>
          <a href="https://soon-campaign-workspace-7kwt.vercel.app/strategy-library" style={{
            fontSize: '13px',
            color: '#888',
            textDecoration: 'none',
            padding: '6px 14px',
            letterSpacing: '0.03em',
          }}>
            📚 Marketing Strategy Library
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
      <body style={{ margin: 0, padding: 0, paddingTop: '52px' }}>
        <NavBar creatorMode={creatorMode} />
        {children}
      </body>
    </html>
  );
}
