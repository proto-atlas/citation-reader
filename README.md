# citation-reader

> 引用元付きのAI要約・Q&Aミニアプリ。Anthropic Citations APIとPrompt Cachingを使ったデモアプリです。

テキストやPDFを投入すると、Claudeが要約と質問応答を返し、回答中のバッジをクリックすると原文の該当箇所がハイライトで示されます。公開URLでのAI API課金・乱用を抑えるため、実APIのQ&Aは招待制（アクセスキー方式）にしています。

## デモ

- **公開URL**: https://citation-reader.atlas-lab.workers.dev（招待制、アクセスキーが必要）
- **GitHub**: https://github.com/proto-atlas/citation-reader

## 確認の流れ

- **30 秒で見る**: 公開URLの認証画面、スクリーンショット、検証記録で公開範囲と引用UIを確認できます。
- **5 分で見る**: [docs/verification.md](./docs/verification.md) に、公開URLで確認できる範囲、キー保護範囲、主な証跡への導線をまとめています。
- **検証記録**: [docs/evidence/INDEX.md](./docs/evidence/INDEX.md) に、README上の主張と証跡ファイルの対応をまとめています。
- **公開範囲**: README、スクリーンショット、公開証跡をキーなしで確認できます。
- **実API**: 課金・乱用防止のためアクセスキーで保護しています。

### なぜアクセスキー制か

Anthropic APIは入出力トークン数に応じた従量課金です。1 リクエストで数セントから数十セント動くため、無認証で公開するとAIコストを意図せず消費する可能性があります。このアプリのアクセスキーはユーザー認証ではなく、公開URLの実API呼び出しの利用量を抑えるためのものです。実API機能は、アクセスキー（Bearer + constant-time比較）、IPとエンドポイント単位のレート制限、Anthropic Spend Limitを併用しています。ユーザー登録を含む運用にする場合は、相手別キー、期限付きキー、利用量の相手別追跡を追加する想定です。

### 画面

| PC | SP（認証画面） | SP（メイン画面） |
|---|---|---|
| ![Desktop](./docs/screenshots/desktop-main.png) | ![Mobile auth](./docs/screenshots/mobile-auth.png) | ![Mobile main](./docs/screenshots/mobile-main.png) |

引用バッジをクリックすると原文の該当箇所がハイライトされます:

![Citation clicked](./docs/screenshots/citation-clicked.png)

## 主な機能

- **引用元付き要約・Q&A**: Anthropic Citations APIによるstreaming表示、バッジ → 原文ハイライト
- **PDF直接アップロード**: ブラウザ側のpdfjs-distで抽出、本文をサーバーに送らない
- **コスト保護**: アクセスキー（Bearer, 長さ差分も含めた定時間比較）+ 短期署名付きsession cookie + Cloudflare Workers Rate Limiting binding（10 req/60s、`/api/auth` `/api/chat` 両方）+ Workers Cache API補助リミッター + 開発時・テスト時のメモリ上の代替処理 + Anthropic側Spend Limit
- **Prompt Caching**: `ephemeral` 5 分TTL、トークン使用量をUI表示
- **キャンセル連動**: UIの中断 → `AbortSignal` → `MessageStream.abort()` でAnthropic側も即停止
- **エラー文言の整形**: サーバ側で内部エラー詳細を漏らさず、UIには `ChatErrorCode` ベースの日本語文言のみ表示（OWASP Improper Error Handling対応）
- **セキュリティヘッダ**: HSTS / X-Content-Type-Options / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy + Content-Security-Policy（XSS対策の一部）
- **a11y**: 全操作要素にラベル関連付け（`htmlFor`）、44pxタッチターゲット、引用元リストもキーボード操作可能（`button` 化）、WCAG AAコントラスト
- **ダークモード手動トグル**: ライト / 自動（OS追従）/ ダーク、`localStorage` 記憶 + FOUC防止
- **Next.js 16 App Router + Cloudflare Workers** のエッジ配信

## Lighthouse (公開URL)

[公開URL](https://citation-reader.atlas-lab.workers.dev/) を 2026-04-28 時点で計測:

| カテゴリ | スコア |
|---|---:|
| Performance | desktop 99 / mobile 89 |
| Accessibility | 95 |
| Best Practices | 100 |
| SEO | 100 |

mobile Performance 89 の主因はTBT 410ms、main-thread 1.3s、JS execution 0.5s。詳細は [`docs/evidence/lighthouse-2026-04-28.md`](./docs/evidence/lighthouse-2026-04-28.md) と [`docs/evidence/mobile-performance-analysis-2026-04-28.md`](./docs/evidence/mobile-performance-analysis-2026-04-28.md) に記録しています。

アクセシビリティ / セキュリティ面では、コントラスト・44pxタッチターゲット・`htmlFor` 関連付け・引用元リストbutton化・CSP / `/api/auth` rate-limit / error sanitize等を実装済みです。

## 使用技術

- Next.js 16.2.6 (App Router, **webpack build**)
- React 19.2.6
- TypeScript 6.0.3 (strict最大、`any` 禁止)
- Tailwind CSS 4.2.4 (class戦略dark mode via `@custom-variant`)
- `@anthropic-ai/sdk` 0.96.0 (Citations + Prompt Caching)
- `pdfjs-dist` 5.6.205 (クライアント側抽出)
- `@opennextjs/cloudflare` 1.19.8 + wrangler 4.97.0
- ESLint 10 (flat config) + Prettier 3
- Vitest 4.1.5 (ユニット 149、coverage stmts 82.83 / branches 82.4 / funcs 83.67 / lines 84.85) + happy-dom + Playwright 1.59 (E2E 5 ブラウザmatrix: Chromium / Firefox / WebKit / mobile-chrome / mobile-safari)

## 必要環境

- Node.js 24.x LTS
- npm 11+

## 開発

```bash
npm install
cp .env.local.example .env.local
# .env.localを編集してACCESS_PASSWORDとANTHROPIC_API_KEYを設定
npm run dev
```

開いたタブでアクセスキーを入力 → メインUIが開きます。サンプル読込ボタンで動作確認できます。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | ローカル開発サーバ（`next dev`） |
| `npm run build` | 本番ビルド（`next build --webpack`） |
| `npm run typecheck` | TypeScript型チェック |
| `npm run lint` | ESLint + Prettier |
| `npm run lint:fix` | 自動修正 |
| `npm test` | Vitestユニットテスト |
| `npm run test:coverage` | カバレッジ付きテスト（thresholds: lines 60% / functions 70% / branches 50%） |
| `npm run e2e` | Playwright E2E（全ブラウザ） |
| `npm run check` | typecheck + lint + test |
| `npm run preview` | OpenNext build + Cloudflareローカルプレビュー |
| `npm run deploy` | OpenNext build + Cloudflare Workersデプロイ |

`postinstall` で `scripts/copy-pdf-worker.mjs` が `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` を `public/` にコピーします（OpenNextが `.open-next/assets/` に取り込む）。

## アーキテクチャ

詳細は [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

## 設計判断

各設計判断の背景とトレードオフは [docs/DESIGN-DECISIONS.md](./docs/DESIGN-DECISIONS.md)。

## デプロイ

Cloudflare Workers経由で公開します。初回だけSecrets設定:

```bash
npx wrangler login
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

### Windows環境の注意

OpenNextはWindows公式サポート外です。`npm run preview` はローカルで 500 を返す可能性がありますが、本番Cloudflare WorkersはLinux相当workerdで動くため影響しません。ローカル検証は `npm run dev` のみ使用してください。

## テスト

```bash
npm run check                          # typecheck + lint + Vitest (149)
npm run test:coverage                  # coverage閾値 (lines 60 / functions 70 / branches 50 / statements 60)
npx playwright test --project=chromium # E2E (8 シナリオ × 5 ブラウザmatrixでCI並列実行、port 3210 固定)
```

E2Eは `playwright.config.ts` の `webServer.env` にE2E専用 `ACCESS_PASSWORD` を注入する設計で、`.env.local` の値には依存しません。`/api/chat` は `page.route()` でSSEモックして実Anthropicへの課金を発生させません。

## CI設定

GitHub Actions (`.github/workflows/ci.yml`) で以下 3 ジョブが走ります:

| ジョブ | 内容 |
|---|---|
| `quality-check` | typecheck → lint → `test:coverage` (閾値強制) → `npm audit --audit-level=high` → secret scan (`scripts/check-secrets.sh`) → build |
| `e2e` | Playwright 5 ブラウザmatrix (Chromium / Firefox / WebKit / mobile-chrome / mobile-safari) で 8 シナリオ並列実行 (auth gate / chat主要フロー / 引用クリック / axe-core a11y)。`quality-check` 通過後、`fail-fast: false` で全ブラウザ結果をartifact保存 |
| `deploy` | `main` へのpushのみ。`quality-check` + `e2e` 通過後、`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` がrepo secretsに登録されている場合だけCloudflare Workersへ自動deploy。未設定の場合はskip |

`npm audit --audit-level=high` は 2026-06-04 時点で 0 vulnerabilitiesです。

## 公開している検証記録

機械検証可能な品質証跡を [`docs/evidence/`](./docs/evidence/) に集約しています ([検証記録の一覧](./docs/evidence/INDEX.md))。確認時は以下の項目を公開状態で確認できます:

- [`dependency-audit-2026-06-04.md`](./docs/evidence/dependency-audit-2026-06-04.md): `npm audit --audit-level=high --json` の再計測結果 (0 vulnerabilities)
- [`dependency-audit-2026-04-27.md`](./docs/evidence/dependency-audit-2026-04-27.md): 過去の `moderate` 6 件の出自・代替検討・上流追跡
- [`dependency-audit-2026-04-28.md`](./docs/evidence/dependency-audit-2026-04-28.md): 本番公開後の `npm audit --audit-level=high --json` 再計測結果
- [`lighthouse-2026-04-28.md`](./docs/evidence/lighthouse-2026-04-28.md): 本番URLのLighthouse 13.0.1 計測結果 (desktop 99 / 95 / 100 / 100、mobile 89 / 95 / 100 / 100)
- [`mobile-performance-analysis-2026-04-28.md`](./docs/evidence/mobile-performance-analysis-2026-04-28.md): mobile Performance 89 の原因分析と次の改善候補
- [`eval-result-2026-04-28.json`](./docs/evidence/eval-result-2026-04-28.json): 本番 `/api/chat` の 実API LLM評価結果 (1 fixture、status 200、引用 1 件、usage記録)
- [`live-ai-check-2026-04-28.md`](./docs/evidence/live-ai-check-2026-04-28.md): 本番 `/api/chat` の 実API確認の要約。secretを出力せず、短い架空fixtureで実行
- [`release-baseline-2026-04-28.md`](./docs/evidence/release-baseline-2026-04-28.md): 次の品質改善前の公開URL / CI / ローカル検証の基準記録
- [`abuse-protection-2026-04-28.md`](./docs/evidence/abuse-protection-2026-04-28.md): `/api/auth` / `/api/chat` のアクセス制御、Rate Limiting binding、コスト保護、残存リスク
- [`deployment-2026-04-28.md`](./docs/evidence/deployment-2026-04-28.md): Cloudflare Workers deploy Version IDとdeploy後の確認
- CI quality-check / e2e matrixの実行履歴: `.github/workflows/ci.yml` およびGitHub Actionsのartifact (`playwright-report-{browser}`)

axe-coreのcritical / serious 0 件確認とlicense inventoryも、同じ検証記録一覧から確認できます。

## LLM出力の評価

`/api/chat` の出力品質を 3 軸 (Markdown混入 / 言語一致 / 引用件数・重複率) で機械的に検査する評価スクリプトを [`eval/`](./eval/) 配下に実装しています。

```bash
npm run eval               # 外部APIなしモード (Anthropic課金ゼロ、CI用)
BASE_URL=https://citation-reader.atlas-lab.workers.dev \
ACCESS_KEY=... \
npm run eval -- --live --limit=1
```

liveモードは本番 `/api/chat` に短い架空fixtureを送信し、SSEの `text` / `citation` / `done.usage` を集約します。`ACCESS_KEY` と `ANTHROPIC_API_KEY` は証跡JSONに保存しません。

評価結果は `docs/evidence/eval-result-{date}.json` に出力されます。liveモードは外部API送信と課金を伴うため、通常は明示的な実行判断の後に `--limit=1` から実行します。

## 依存関係と制約

### npm auditの扱い

2026-06-04 時点の `npm audit --audit-level=high --json` はexit 0、0 vulnerabilitiesです。結果は [`docs/evidence/dependency-audit-2026-06-04.md`](./docs/evidence/dependency-audit-2026-06-04.md) と [`docs/evidence/npm-audit-2026-06-04.json`](./docs/evidence/npm-audit-2026-06-04.json) に記録しています。

2026-04-27 から 2026-04-29 の依存監査記録は、当時残っていた `moderate` advisoryの扱いを残す履歴です。現在のlockfileでは `npm audit fix` により解消済みです。

### LGPLコンポーネント

`@img/sharp-win32-x64@0.34.5` のライセンスに `LGPL-3.0-or-later` が含まれます。これは `sharp` のoptional binary依存で、`sharp` 自体も `next` のoptional dependency経由 (Image Optimization用) です。Cloudflare Workersにデプロイする本アプリではLinux x64 binaryが選ばれるため、Windows版binaryを再配布する形にはなりません。配布形態としてのLGPL義務は発生しないと判断しています（npmのライセンス情報自体は `npx license-checker` で確認可能）。

### `esbuild` 直接devDependency

`esbuild` は `@opennextjs/cloudflare` のpeer要件として明示的にdevDepに置いています。本リポジトリのソースから直接importはしていません。

## ライセンス

MIT
