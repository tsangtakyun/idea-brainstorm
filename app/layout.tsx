import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SOON · Idea Collection",
  description: "AI-powered idea brainstorm collection by SOON",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
