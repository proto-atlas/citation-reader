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
│    └─ checkAccess (constant-time)       │
│                                         │
│  /api/chat                              │
│    ├─ checkAccess                       │
│    ├─ checkRateLimit (10 req / 60s)     │
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
2. サーバ: `checkAccess` → `checkRateLimit` → サイズ検証
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
    ├── rate-limit.ts        # sliding window + getClientIp
    ├── sse-client.ts        # SSE パース
    ├── pdf-extract.ts       # buildPageText + normalizeExtractedText
    ├── models.ts            # 固定モデル識別子
    ├── theme.ts             # テーマ localStorage アクセサ
    └── types.ts             # 共有型

e2e/
└── auth.spec.ts             # Playwright 認証シナリオ

scripts/
├── check-before-publish.sh  # 禁止ワード grep
└── husky-pre-commit.template.txt
```

## テスト戦略

| 層 | 対象 | ツール | 件数 |
|---|---|---|---|
| Unit | `lib/auth` / `lib/rate-limit` / `lib/sse-client` / `lib/pdf-extract` | Vitest (Node 環境) | 39 |
| E2E | 認証ゲート（正常 / 異常 / disabled） | Playwright (Chromium) | 3 |

`pdf-extract.ts` は pdfjs-dist の Worker 依存で Node 環境では動かないため、抽出ロジックを `buildPageText` / `normalizeExtractedText` の pure 関数に分離して単体テスト可能にしています。

## CI

`.github/workflows/ci.yml` で 2 ジョブ:

1. **quality-gate**: `npm ci` → typecheck → lint → test → check:publish → build
2. **e2e**: quality-gate 成功後、`playwright install --with-deps chromium` → build → E2E → artifact upload

E2E レポートは失敗時も artifact として保存され、14 日間保持。

## セキュリティ境界

- **API Key**: Cloudflare Workers Secrets のみ（コード / 環境変数にハードコードしない）
- **アクセスキー**: constant-time 比較（既知制約: 長さ流出。共有秘密なので実害限定、コメントで明示）
- **レート制限**: IP 単位 10 req / 60s（sliding window、in-memory）
- **セキュリティヘッダ**: nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy
- **XSS**: React 標準エスケープ。`dangerouslySetInnerHTML` は FOUC 防止 inline script のみ（固定文字列、ユーザー入力に依存しない）
- **本文ログ**: `wrangler tail` でもドキュメント本文を出力しない
