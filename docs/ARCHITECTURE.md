# アーキテクチャ

## 概要

citation-readerはNext.js 16 App Routerの 1 ページアプリで、Cloudflare Workers上で動作します。ブラウザからAnthropic Messages APIに直接接続せず、Workersの `/api/chat` を経由することでアクセスキーとAPIキーの漏洩リスクを分離しています。

## コンポーネント構成

```
┌─────────────────────────────────────────┐
│  ブラウザ (Next.js App Router client)   │
│                                         │
│  PasswordGate                           │
│    └─ /api/auth (Bearer検証のみ)       │
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
                │ AbortSignalで中断連動
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
│    ├─ signed session / Bearer代替認証  │
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
3. 成功でメインUIを開く / 失敗で再入力

### 2. ドキュメント投入

- **テキスト直接入力**: `textarea` に貼り付け
- **PDFアップロード**: `<input type="file">` → `pdfjs-dist` 動的import → `buildPageText` → `normalizeExtractedText` で整形
  - PDFバイナリはサーバに送らない
  - 日本語の文字単位分割で余計な空白が入らないよう、連結はセパレータ無し
  - 行末は `hasEOL` で判定

### 3. 質問送信とストリーミング

1. `QuestionForm` の送信で `streamChat({ documentText, question?, password })`
2. サーバ: session cookie / Bearer認証 → `checkRateLimitFromContext` → サイズ検証
3. サーバ: Anthropic SDKでCitations + Prompt Caching付きの `messages.stream`
4. サーバ: SSEイベント（`meta` / `text` / `citation` / `error` / `done`）を発行
5. クライアント: `sse-client.ts` が `\n\n` 区切りでパース、`AnswerBlock` 配列に上書き統合
6. `AnswerView` がtextとcitationバッジを描画
7. バッジクリックで `SourceViewer` が `documentText` の該当範囲をハイライト

### 4. キャンセル

- UIのキャンセルボタン → `AbortController.abort()`
- `fetch({ signal })` が中断され、サーバ側は `req.signal.aborted` を検知して `messageStream.abort()` を呼び、Anthropicへのコストも即停止

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx           # ルートレイアウト、FOUC防止inline script
│   ├── page.tsx             # CitationReaderApp（メインUI）
│   ├── globals.css          # Tailwind v4 + @custom-variant dark
│   └── api/
│       ├── auth/route.ts    # アクセスキー検証
│       └── chat/route.ts    # AIストリーミング本体
├── components/
│   ├── PasswordGate.tsx
│   ├── DocumentInput.tsx    # テキスト貼付 + PDFアップロード
│   ├── QuestionForm.tsx
│   ├── AnswerView.tsx       # 引用バッジ描画
│   ├── SourceViewer.tsx     # 原文ハイライト
│   └── ThemeToggle.tsx      # ライト/自動/ダーク
└── lib/
    ├── auth.ts              # checkAccess + constant-time
    ├── rate-limit.ts        # 開発・テスト時の代替sliding window + getClientIp
    ├── rate-limit-binding.ts # Cloudflare Rate Limiting binding + Workers Cache API補助wrapper
    ├── session.ts           # HMAC署名付き短期session cookie
    ├── sse-client.ts        # SSEパース
    ├── pdf-extract.ts       # buildPageText + normalizeExtractedText
    ├── models.ts            # 固定モデル識別子
    ├── theme.ts             # テーマlocalStorageアクセサ
    └── types.ts             # 共有型

e2e/
├── auth.spec.ts             # Playwright認証シナリオ
└── chat.spec.ts             # SSEモック、引用クリック、429表示

scripts/
└── check-secrets.sh         # CIで実行するsecret pattern検査
```

## テスト戦略

| 層 | 対象 | ツール | 件数 |
|---|---|---|---|
| Unit | `lib/auth` / `lib/rate-limit` / `lib/rate-limit-binding` / `lib/session` / `lib/sse-client` / `lib/pdf-extract` / eval helpers | Vitest | 149 |
| E2E | 認証画面 / SSE応答置き換え / 引用クリック / 429表示 / axe-core a11y | Playwright 5ブラウザmatrix | 8 scenarios |

`pdf-extract.ts` はpdfjs-distのWorker依存でNode環境では動かないため、抽出ロジックを `buildPageText` / `normalizeExtractedText` のpure関数に分離して単体テスト可能にしています。

## CI設定

`.github/workflows/ci.yml` で 2 ジョブ:

1. **quality-check**: `npm ci` → typecheck → lint → `test:coverage` → secret scan → `npm audit --audit-level=high` → build
2. **e2e**: quality-check成功後、Chromium / Firefox / WebKit / mobile-chrome / mobile-safariのmatrixでE2E → artifact upload
3. **deploy**: main push時のみ、Cloudflare secretsが登録済みなら自動deploy。未設定ならskip。

E2Eレポートは失敗時もartifactとして保存され、14 日間保持。

## セキュリティ境界

- **API Key**: Cloudflare Workers Secretsのみ（コード / 環境変数にハードコードしない）
- **アクセスキー**: 長さ差分も含めて最後に判定する定時間比較
- **短期session**: `/api/auth` 成功後にHMAC署名付き `__Host-` cookieを発行し、`/api/chat` はcookie優先・Bearerを代替として扱う
- **レート制限**: 本番はCloudflare Workers Rate Limiting binding (`RATE_LIMITER`, 10 req / 60s) + Workers Cache API補助。開発時とテスト時は同じwrapperからメモリ上の代替処理を使う
- **セキュリティヘッダ**: nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy
- **XSS**: React標準エスケープ。`dangerouslySetInnerHTML` はFOUC防止inline scriptのみ（固定文字列、ユーザー入力に依存しない）
- **本文ログ**: `wrangler tail` でもドキュメント本文を出力しない
