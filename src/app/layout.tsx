import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// OG/canonical/robots/sitemap を定義する (favicon は app/icon.svg、404 は not-found.tsx で別途対応済)。
// 招待制 1 ページデモなので canonical / sitemap までは不要、OG / favicon を最低限揃える。
const SITE_URL = 'https://citation-reader.atlas-lab.workers.dev';
const SITE_TITLE = 'citation-reader — 引用元付き AI 要約・Q&A';
const SITE_DESCRIPTION =
  'テキストや PDF をアップロードすると AI が要約と引用元付きの質問応答を返します。Anthropic Citations API + Prompt Caching のデモ。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'citation-reader',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'ja_JP',
    images: [
      {
        url: '/opengraph-image.svg',
        width: 1200,
        height: 630,
        type: 'image/svg+xml',
        alt: 'citation-reader — Anthropic Citations + Prompt Caching demo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image.svg'],
  },
};

// FOUC（ハイドレーション前のフラッシュ）防止のため、head で早期にテーマ class を適用する inline script。
// localStorage 未設定時は prefers-color-scheme に追従。
const themeInitScript = `(function(){try{var t=localStorage.getItem('citation-reader.theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=(t==='dark')||(t!=='light'&&m);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
