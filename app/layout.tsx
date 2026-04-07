import Link from 'next/link'
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SOON · Idea Collection",
  description: "SOON campaign workspace and idea system",
};

function NavBar() {
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
      <Link href="/" style={{ fontSize: '13px', letterSpacing: '0.15em', color: '#888', textDecoration: 'none' }}>
        SOON
      </Link>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link href="/submit-brief" style={{
          fontSize: '13px',
          color: '#1a1a1a',
          textDecoration: 'none',
          padding: '6px 14px',
          borderBottom: '1px solid #1a1a1a',
          letterSpacing: '0.03em',
        }}>
          Campaign Submit
        </Link>
        <Link href="/ops/campaigns" style={{
          fontSize: '13px',
          color: '#1a1a1a',
          textDecoration: 'none',
          padding: '6px 14px',
          borderBottom: '1px solid #1a1a1a',
          letterSpacing: '0.03em',
        }}>
          Ops Workspace
        </Link>
        <a href="https://idea-brainstorm.vercel.app" style={{
          fontSize: '13px',
          color: '#1a1a1a',
          textDecoration: 'none',
          padding: '6px 14px',
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
        <a href="https://soon-strategy-library.vercel.app/strategy-library" style={{
          fontSize: '13px',
          color: '#888',
          textDecoration: 'none',
          padding: '6px 14px',
          letterSpacing: '0.03em',
        }}>
          📚 Marketing Strategy Library
        </a>
      </div>
    </nav>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK">
      <body style={{ margin: 0, padding: 0, paddingTop: '52px' }}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
