import type { Metadata } from 'next';
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const display = Big_Shoulders({
  subsets: ['latin'],
  weight: ['600', '700', '900'],
  variable: '--font-display',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'BATTLE OPS // ポケモンチャンピオンズ対戦補佐',
  description: '選出・技選択・交代判断を理由付きで提案する対戦補佐AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans">
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
