import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  // OpenNext Cloudflareが .next/standalone/ を参照するため必須（pages-manifest.json欠落エラー回避）
  output: 'standalone',
  // x-powered-by: Next.jsを出力しない (情報露出の最小化)
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },
  // セキュリティヘッダ + CSP (XSS対策の一部)
  async headers() {
    // CSP: 1 行に詰めると読みづらいため配列で組成。
    // 注意: next dev (development) ではReactのdebug機能がeval() を使うためCSP警告がコンソールに
    // 出る。本番 (next build --webpack) ではeval不使用なので 'unsafe-eval' を含めない方針。
    const csp = [
      "default-src 'self'",
      // Next.jsのハイドレーションスクリプトとlayout.tsxのtheme初期化スクリプトが
      // インラインなので 'unsafe-inline' が必要 (nonce化は将来課題)。
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      // pdfjs-distはpublic/pdf.worker.min.mjsを /pdf.worker.min.mjsとして読む (同origin)。
      // blob: は念のため (将来inline worker化した場合の互換)。
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
          // Cloudflare Workersは常時HTTPS、サブドメインも対象
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
