# citation-reader

> 引用元付きの AI 要約・Q&A ミニアプリ。Anthropic Citations API と Prompt Caching の実運用デモ。

テキストや PDF を投入すると、Claude が要約と質問応答を返し、回答中のバッジをクリックすると原文の該当箇所がハイライトで示されます。公開デモでのAI API課金・乱用を抑えるため、live Q&Aは招待制（アクセスキー方式）にしています。

## Demo

- **Live demo**: https://citation-reader.atlas-lab.workers.dev （招待制、アクセスキーが必要）
- **Source**: https://github.com/proto-atlas/citation-reader

## Reviewer Quick Path

- **30 秒で見る**: Live demo の認証画面、スクリーンショット、Evidence で公開範囲と引用UIを確認できます。
- **5 分で見る**: [docs/REVIEWER.md](./docs/REVIEWER.md) に、公開デモ範囲、キー保護範囲、主な証跡への導線をまとめています。
- **Evidence**: [docs/evidence/REVIEWER-INDEX.md](./docs/evidence/REVIEWER-INDEX.md) に、README上の主張と証跡ファイルの対応をまとめています。
- **Public scope**: README、スクリーンショット、公開証跡をキーなしで確認できます。
- **Live AI**: 課金・乱用防止のためアクセスキーで保護しています。

### なぜアクセスキー制か

Anthropic API は入出力トークン数に応じた従量課金です。1 リクエストで数セント〜数十セント動くため、無認証で公開すると AI コストの消費攻撃を受ける可能性があります。本デモのアクセスキーはユーザー認証ではなく、公開ポートフォリオの live AI 呼び出しを守る cost guard です。live AI 機能は、アクセスキー（Bearer + constant-time 比較）+ IP/エンドポイント単位のレート制限 + Anthropic Spend Limit の三段で守っています。本番 SaaS として運用する場合は、相手別キー、期限付きキー、利用量の相手別追跡を追加する想定です。

### Screenshots

| Desktop | Mobile (auth gate) | Mobile (main) |
|---|---|---|
| ![Desktop](./docs/screenshots/desktop-main.png) | ![Mobile auth](./docs/screenshots/mobile-auth.png) | ![Mobile main](./docs/screenshots/mobile-main.png) |

引用バッジをクリックすると原文の該当箇所がハイライトされます:

![Citation clicked](./docs/screenshots/citation-clicked.png)

## Features

- **引用元付き要約・Q&A**: Anthropic Citations API による streaming 表示、バッジ → 原文ハイライト
- **PDF 直接アップロード**: ブラウザ側の pdfjs-dist で抽出、本文をサーバーに送らない
- **コスト保護の多層ゲート**: アクセスキー（Bearer, 長さ差分も含めた定時間比較）+ 短期署名付き session cookie + Cloudflare Workers Rate Limiting binding（10 req/60s、`/api/auth` `/api/chat` 両方）+ Workers Cache API 補助リミッター + dev/test 用 in-memory fallback + Anthropic 側 Spend Limit
- **Prompt Caching**: `ephemeral` 5 分 TTL、トークン使用量を UI 表示
- **キャンセル連動**: UI の中断 → `AbortSignal` → `MessageStream.abort()` で Anthropic 側も即停止
- **エラー文言の整形**: サーバ側で内部エラー詳細を漏らさず、UI には `ChatErrorCode` ベースの日本語文言のみ表示（OWASP Improper Error Handling 対応）
- **セキュリティヘッダ**: HSTS / X-Content-Type-Options / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy + Content-Security-Policy（XSS 最終防衛）
- **a11y**: 全操作要素にラベル関連付け（`htmlFor`）、44px タッチターゲット、引用元リストもキーボード操作可能（`button` 化）、WCAG AA コントラスト
- **ダークモード手動トグル**: ライト / 自動（OS 追従）/ ダーク、`localStorage` 記憶 + FOUC 防止
- **Next.js 16 App Router + Cloudflare Workers** のエッジ配信

## Lighthouse (production)

[Production URL](https://citation-reader.atlas-lab.workers.dev/) を 2026-04-28 時点で計測:

| カテゴリ | スコア |
|---|---:|
| Performance | desktop 99 / mobile 89 |
| Accessibility | 95 |
| Best Practices | 100 |
| SEO | 100 |

mobile Performance 89 の主因は TBT 410ms、main-thread 1.3s、JS execution 0.5s。詳細は [`docs/evidence/lighthouse-2026-04-28.md`](./docs/evidence/lighthouse-2026-04-28.md) と [`docs/evidence/mobile-performance-analysis-2026-04-28.md`](./docs/evidence/mobile-performance-analysis-2026-04-28.md) に記録しています。

アクセシビリティ / セキュリティ面では、コントラスト・44px タッチターゲット・`htmlFor` 関連付け・引用元リスト button 化・CSP / `/api/auth` rate-limit / error sanitize 等を実装済みです。

## Tech Stack

- Next.js 16.2.4 (App Router, **webpack build**)
- React 19.2.5
- TypeScript 6.0.3 (strict 最大、`any` 禁止)
- Tailwind CSS 4.2.4 (class 戦略 dark mode via `@custom-variant`)
- `@anthropic-ai/sdk` 0.90.0 (Citations + Prompt Caching)
- `pdfjs-dist` 5.6.205 (クライアント側抽出)
- `@opennextjs/cloudflare` 1.19.3 + wrangler 4.84.1
- ESLint 10 (flat config) + Prettier 3
- Vitest 4.1.5 (ユニット 135、coverage stmts 81.41 / branches 80 / funcs 85 / lines 83.52) + happy-dom + Playwright 1.59 (E2E 5 ブラウザ matrix: Chromium / Firefox / WebKit / mobile-chrome / mobile-safari)

## Requirements

- Node.js 24.x LTS
- npm 11+

## Development

```bash
npm install
cp .env.local.example .env.local
# .env.local を編集して ACCESS_PASSWORD と ANTHROPIC_API_KEY を設定
npm run dev
```

開いたタブでアクセスキーを入力 → メイン UI が開きます。サンプル読込ボタンで動作確認できます。

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | ローカル開発サーバ（`next dev`） |
| `npm run build` | 本番ビルド（`next build --webpack`） |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint + Prettier |
| `npm run lint:fix` | 自動修正 |
| `npm test` | Vitest ユニットテスト |
| `npm run test:coverage` | カバレッジ付きテスト（thresholds: lines 60% / functions 70% / branches 50%） |
| `npm run e2e` | Playwright E2E（全ブラウザ） |
| `npm run check` | typecheck + lint + test |
| `npm run preview` | OpenNext build + Cloudflare ローカルプレビュー |
| `npm run deploy` | OpenNext build + Cloudflare Workers デプロイ |

`postinstall` で `scripts/copy-pdf-worker.mjs` が `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` を `public/` にコピーします（OpenNext が `.open-next/assets/` に取り込む）。

## Architecture

詳細は [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

## Design Decisions

各設計判断の背景とトレードオフは [docs/DESIGN-DECISIONS.md](./docs/DESIGN-DECISIONS.md)。

## Deployment

Cloudflare Workers 経由で公開します。初回だけ Secrets 設定:

```bash
npx wrangler login
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

### Windows 環境の注意

OpenNext は Windows 公式サポート外です。`npm run preview` はローカルで 500 を返す可能性がありますが、本番 Cloudflare Workers は Linux 相当 workerd で動くため影響しません。ローカル検証は `npm run dev` のみ使用してください。

## Testing

```bash
npm run check                          # typecheck + lint + Vitest (135)
npm run test:coverage                  # coverage gate (lines 60 / functions 70 / branches 50 / statements 60)
npx playwright test --project=chromium # E2E (8 シナリオ × 5 ブラウザ matrix で CI 並列実行、port 3210 固定)
```

E2E は `playwright.config.ts` の `webServer.env` に E2E 専用 `ACCESS_PASSWORD` を注入する設計で、`.env.local` の値には依存しません。`/api/chat` は `page.route()` で SSE モックして実 Anthropic への課金を発生させません。

## CI / DevOps

GitHub Actions (`.github/workflows/ci.yml`) で以下 3 ジョブが走ります:

| ジョブ | 内容 |
|---|---|
| `quality-gate` | typecheck → lint → `test:coverage` (閾値強制) → `npm audit --audit-level=high` → secret scan (`scripts/check-secrets.sh`) → build |
| `e2e` | Playwright 5 ブラウザ matrix (Chromium / Firefox / WebKit / mobile-chrome / mobile-safari) で 8 シナリオ並列実行 (auth gate / chat 主要フロー / 引用クリック / axe-core a11y)。`quality-gate` 通過後、`fail-fast: false` で全ブラウザ結果を artifact 保存 |
| `deploy` | `main` への push のみ。`quality-gate` + `e2e` 通過後、`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` が repo secrets に登録されている場合だけ Cloudflare Workers へ自動 deploy。未設定の場合は skip |

`npm audit` は `--audit-level=high` でブロッキング、`moderate` レベルは Next.js / OpenNext の transitive 由来でアップストリーム修正待ちのため意図的に許容しています (下記「Dependencies and Known Constraints」)。

## Public Evidence

機械検証可能な品質証跡を [`docs/evidence/`](./docs/evidence/) に集約しています ([公開向けインデックス](./docs/evidence/REVIEWER-INDEX.md))。第三者確認では以下の項目を Public な状態で確認できます:

- [`dependency-audit-2026-04-27.md`](./docs/evidence/dependency-audit-2026-04-27.md) — npm audit `moderate` 6 件の出自・代替検討・上流追跡
- [`dependency-audit-2026-04-28.md`](./docs/evidence/dependency-audit-2026-04-28.md) — 本番公開後の `npm audit --audit-level=high --json` 再計測結果
- [`lighthouse-2026-04-28.md`](./docs/evidence/lighthouse-2026-04-28.md) — 本番 URL の Lighthouse 13.0.1 計測結果 (desktop 99 / 95 / 100 / 100、mobile 89 / 95 / 100 / 100)
- [`mobile-performance-analysis-2026-04-28.md`](./docs/evidence/mobile-performance-analysis-2026-04-28.md) — mobile Performance 89 の原因分析と次の改善候補
- [`eval-result-2026-04-28.json`](./docs/evidence/eval-result-2026-04-28.json) — 本番 `/api/chat` の live LLM 評価結果 (1 fixture、status 200、引用 1 件、usage 記録)
- [`live-ai-smoke-2026-04-28.md`](./docs/evidence/live-ai-smoke-2026-04-28.md) — 本番 `/api/chat` の live smoke summary。secret を出力せず、短い架空 fixture で実行
- [`release-baseline-2026-04-28.md`](./docs/evidence/release-baseline-2026-04-28.md) — 次の品質改善前の公開URL / CI / local verification baseline
- [`abuse-protection-2026-04-28.md`](./docs/evidence/abuse-protection-2026-04-28.md) — `/api/auth` / `/api/chat` のアクセス制御、Rate Limiting binding、cost guard、残存リスク
- [`deployment-2026-04-28.md`](./docs/evidence/deployment-2026-04-28.md) — Cloudflare Workers deploy Version ID と deploy後 smoke
- CI quality-gate / e2e matrix の実行履歴 — `.github/workflows/ci.yml` および GitHub Actions の artifact (`playwright-report-{browser}`)

axe / license inventory は本番 deploy 後のサイクルで `docs/evidence/` に追加予定。

## LLM Evaluation Harness

`/api/chat` の出力品質を 3 軸 (Markdown 混入 / 言語一致 / 引用件数・重複率) で機械的に検査する評価ハーネスを [`eval/`](./eval/) 配下に実装しています。

```bash
npm run eval               # mock モード (Anthropic 課金ゼロ、CI 用)
BASE_URL=https://citation-reader.atlas-lab.workers.dev \
ACCESS_KEY=... \
npm run eval -- --live --limit=1
```

live モードは本番 `/api/chat` に短い架空 fixture を送信し、SSE の `text` / `citation` / `done.usage` を集約します。`ACCESS_KEY` と `ANTHROPIC_API_KEY` は証跡 JSON に保存しません。

評価結果は `docs/evidence/eval-result-{date}.json` に出力されます。live モードは外部 API 送信と課金を伴うため、通常は明示的な実行判断の後に `--limit=1` から実行します。

## Dependencies and Known Constraints

### npm audit

`npm audit` で `moderate` 6 件が検出されますが、いずれも `next@16.2.4` 配下の `postcss@8.4.31` と `@aws-sdk/xml-builder` 経由の `fast-xml-parser@5.5.8` 由来です。`npm audit fix --force` は `next` を 9 系へダウングレードする提案を含むため適用していません。本リポジトリでは Next.js / OpenNext の次リリースで連鎖修正される想定で、状況を `docs/DESIGN-DECISIONS.md` に記録しています。

### LGPL コンポーネント

`@img/sharp-win32-x64@0.34.5` のライセンスに `LGPL-3.0-or-later` が含まれます。これは `sharp` の optional binary 依存で、`sharp` 自体も `next` の optional dependency 経由 (Image Optimization 用) です。Cloudflare Workers にデプロイする本アプリでは Linux x64 binary が選ばれるため、Windows 版 binary を再配布する形にはなりません。配布形態としての LGPL 義務は発生しないと判断しています（npm のライセンス情報自体は `npx license-checker` で確認可能）。

### `esbuild` 直接 devDependency

`esbuild` は `@opennextjs/cloudflare` の peer 要件として明示的に devDep に置いています。本リポジトリのソースから直接 import はしていません。

## License

MIT
