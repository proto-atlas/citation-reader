import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  // OpenNext Cloudflare が .next/standalone/ を参照するため必須（pages-manifest.json 欠落エラー回避）
  output: 'standalone',
  // x-powered-by: Next.js を出力しない (情報露出の最小化)
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },
  // セキュリティヘッダ + CSP (XSS 最終防衛)
  async headers() {
    // CSP: 1 行で組み立てるとレビュー時に読みづらいため配列で組成。
    // 注意: next dev (development) では React の debug 機能が eval() を使うため CSP 警告がコンソールに
    // 出る。本番 (next build --webpack) では eval 不使用なので 'unsafe-eval' を含めない方針。
    const csp = [
      "default-src 'self'",
      // Next.js のハイドレーションスクリプトと layout.tsx の theme 初期化スクリプトが
      // インラインなので 'unsafe-inline' が必要 (nonce 化は将来課題)。
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      // pdfjs-dist は public/pdf.worker.min.mjs を /pdf.worker.min.mjs として読む (同 origin)。
      // blob: は念のため (将来 inline worker 化した場合の互換)。
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Cloudflare Workers は常時 HTTPS、サブドメインも対象
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
