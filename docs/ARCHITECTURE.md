# Architecture

## 概要

citation-reader は Next.js 16 App Router の 1 ページアプリで、Cloudflare Workers 上で動作します。ブラウザから Anthropic Messages API に直接接続せず、Workers の `/api/chat` を経由することでアクセスキーと API キーの漏洩リスクを分離しています。

## コンポーネント構成

```
┌─────────────────────────────────────────┐
│  ブラウザ (Next.js App Router client)   │
│                                         │
│  PasswordGate                           │
│    └─ /api/auth (Bearer 検証のみ)       │
│                                         │
│  CitationReaderApp                      │
│    ├─ DocumentInput                     │
│    │    └─ pdfjs-dist (dynamic import)  │
│    ├─ QuestionForm                      │
│    ├─ AnswerView (バッジ描画)           │
│    ├─ SourceViewer (原文ハイライト)     │
│    └─ ThemeToggle                       │
│                                         │
│  sse-client.streamChat                  │
│    └─ fetch('/api/chat', { signal })    │
└───────────────┬─────────────────────────┘
                │ SSE (text/event-stream)
                │ AbortSignal で中断連動
                ▼
┌─────────────────────────────────────────┐
│  Cloudflare Workers (@opennextjs)       │
│                                         │
│  /api/auth                              │
│    ├─ checkRateLimitFromContext         │
│    ├─ checkAccess (constant-time)       │
│    └─ signed session cookie             │
│                                         │
│  /api/chat                              │
│    ├─ signed session / Bearer fallback  │
│    ├─ checkRateLimitFromContext         │
│    ├─ validate (≤200,000 chars)         │
│    └─ anthropic.messages.stream(...)    │
│         citations + prompt caching      │
│         req.signal → stream.abort()     │
└───────────────┬─────────────────────────┘
                │ Anthropic API
                ▼
┌─────────────────────────────────────────┐
│  Anthropic (claude-haiku-4-5-20251001)  │
│    content_block_delta + citations_delta│
└─────────────────────────────────────────┘
```

## データフロー

### 1. 認証

1. `PasswordGate` が `localStorage['citation-reader.access']` を読む
2. 保存済キーがあれば `/api/auth` にサーバ検証リクエスト（失効キーの自動削除のため）
3. 成功でメイン UI を開く / 失敗で再入力

### 2. ドキュメント投入

- **テキスト直接入力**: `textarea` に貼り付け
- **PDF アップロード**: `<input type="file">` → `pdfjs-dist` 動的 import → `buildPageText` → `normalizeExtractedText` で整形
  - PDF バイナリはサーバに送らない
  - 日本語の文字単位分割で余計な空白が入らないよう、連結はセパレータ無し
  - 行末は `hasEOL` で判定

### 3. 質問送信とストリーミング

1. `QuestionForm` の送信で `streamChat({ documentText, question?, password })`
2. サーバ: session cookie / Bearer 認証 → `checkRateLimitFromContext` → サイズ検証
3. サーバ: Anthropic SDK で Citations + Prompt Caching 付きの `messages.stream`
4. サーバ: SSE イベント（`meta` / `text` / `citation` / `error` / `done`）を発行
5. クライアント: `sse-client.ts` が `\n\n` 区切りでパース、`AnswerBlock` 配列に上書き統合
6. `AnswerView` が text と citation バッジを描画
7. バッジクリックで `SourceViewer` が `documentText` の該当範囲をハイライト

### 4. キャンセル

- UI のキャンセルボタン → `AbortController.abort()`
- `fetch({ signal })` が中断され、サーバ側は `req.signal.aborted` を検知して `messageStream.abort()` を呼び、Anthropic へのコストも即停止

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx           # ルートレイアウト、FOUC 防止 inline script
│   ├── page.tsx             # CitationReaderApp（メイン UI）
│   ├── globals.css          # Tailwind v4 + @custom-variant dark
│   └── api/
│       ├── auth/route.ts    # アクセスキー検証
│       └── chat/route.ts    # AI ストリーミング本体
├── components/
│   ├── PasswordGate.tsx
│   ├── DocumentInput.tsx    # テキスト貼付 + PDF アップロード
│   ├── QuestionForm.tsx
│   ├── AnswerView.tsx       # 引用バッジ描画
│   ├── SourceViewer.tsx     # 原文ハイライト
│   └── ThemeToggle.tsx      # ライト/自動/ダーク
└── lib/
    ├── auth.ts              # checkAccess + constant-time
    ├── rate-limit.ts        # dev/test fallback sliding window + getClientIp
    ├── rate-limit-binding.ts # Cloudflare Rate Limiting binding + Workers Cache API補助 wrapper
    ├── session.ts           # HMAC署名付き短期session cookie
    ├── sse-client.ts        # SSE パース
    ├── pdf-extract.ts       # buildPageText + normalizeExtractedText
    ├── models.ts            # 固定モデル識別子
    ├── theme.ts             # テーマ localStorage アクセサ
    └── types.ts             # 共有型

e2e/
├── auth.spec.ts             # Playwright 認証シナリオ
└── chat.spec.ts             # SSEモック、引用クリック、429表示

scripts/
└── check-secrets.sh         # CI-safe secret pattern scan
```

## テスト戦略

| 層 | 対象 | ツール | 件数 |
|---|---|---|---|
| Unit | `lib/auth` / `lib/rate-limit` / `lib/rate-limit-binding` / `lib/session` / `lib/sse-client` / `lib/pdf-extract` / eval helpers | Vitest | 149 |
| E2E | 認証ゲート / SSEモック / 引用クリック / 429表示 / axe-core a11y | Playwright 5ブラウザmatrix | 8 scenarios |

`pdf-extract.ts` は pdfjs-dist の Worker 依存で Node 環境では動かないため、抽出ロジックを `buildPageText` / `normalizeExtractedText` の pure 関数に分離して単体テスト可能にしています。

## CI

`.github/workflows/ci.yml` で 2 ジョブ:

1. **quality-gate**: `npm ci` → typecheck → lint → `test:coverage` → secret scan → `npm audit --audit-level=high` → build
2. **e2e**: quality-gate 成功後、Chromium / Firefox / WebKit / mobile-chrome / mobile-safari の matrix で E2E → artifact upload
3. **deploy**: main push時のみ、Cloudflare secretsが登録済みなら自動deploy。未設定ならskip。

E2E レポートは失敗時も artifact として保存され、14 日間保持。

## セキュリティ境界

- **API Key**: Cloudflare Workers Secrets のみ（コード / 環境変数にハードコードしない）
- **アクセスキー**: 長さ差分も含めて最後に判定する定時間比較
- **短期session**: `/api/auth` 成功後にHMAC署名付き `__Host-` cookie を発行し、`/api/chat` はcookie優先・Bearer fallback
- **レート制限**: 本番は Cloudflare Workers Rate Limiting binding (`RATE_LIMITER`, 10 req / 60s) + Workers Cache API補助。dev/testは同じwrapperからin-memory fallback
- **セキュリティヘッダ**: nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy
- **XSS**: React 標準エスケープ。`dangerouslySetInnerHTML` は FOUC 防止 inline script のみ（固定文字列、ユーザー入力に依存しない）
- **本文ログ**: `wrangler tail` でもドキュメント本文を出力しない
