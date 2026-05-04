# Evidence (Public 証跡)

最終更新: 2026-04-29

第三者確認向けに、citation-reader の品質 / セキュリティ / a11y / 依存関係 / LLM 出力品質の **機械検証可能な証跡** を集約したフォルダ。

## 集約済の証跡

### 依存関係 audit

- [`dependency-audit-2026-04-27.md`](./dependency-audit-2026-04-27.md) — npm audit `moderate` 6 件の出自表 / 試行 4 案の却下根拠 / アップストリーム追跡 / 第三者確認上の扱い
- [`dependency-audit-2026-04-28.md`](./dependency-audit-2026-04-28.md) — 本番公開後の `npm audit --audit-level=high --json` 再計測結果。high / critical 0 件、moderate 6 件
- [`dependency-advisory-map-2026-04-29.md`](./dependency-advisory-map-2026-04-29.md) — 2026-04-29 時点の `moderate` 6 件について、package / path / exposure / decision を整理
- 再実行: `npm audit --audit-level=high` (CI quality-gate でブロッキング、`high` 以上は 0 件保証)

### LLM 出力品質評価

- [`eval-result-2026-04-28.json`](./eval-result-2026-04-28.json) — `eval/runner.mjs --live --limit=1` の最新実行結果。`ja-edge-summary` が status 200、引用 1 件で pass
- [`eval-result-2026-04-29.json`](./eval-result-2026-04-29.json) — `eval/runner.mjs` の mock 実行結果。外部AI APIを呼ばず、3 fixture の読み込みと evidence 書き出し経路を確認
- [`live-ai-smoke-2026-04-28.md`](./live-ai-smoke-2026-04-28.md) — 本番 `/api/chat` の live smoke summary。secret を出力せず、短い架空 fixture で実行
- [`citation-quality-2026-04-29.md`](./citation-quality-2026-04-29.md) — live eval の citationCount / duplicateRate / errors と evidence-only citation validation stats の確認範囲を整理
- [`sdk-boundary-2026-04-29.md`](./sdk-boundary-2026-04-29.md) — Anthropic SDK stream event処理をroute本体からadapterへ分離し、route本体のunsafe lint suppressionを削除した証跡
- 評価関数本体: [`../../eval/evaluators.ts`](../../eval/evaluators.ts) — Markdown 混入 / 言語一致 / 引用件数・重複率の 3 軸を純関数で実装、Vitest で 23 件カバー
- 再実行: `npm run eval` (mock モード)
- live 再実行: `BASE_URL=https://citation-reader.atlas-lab.workers.dev ACCESS_KEY=... npm run eval -- --live --limit=1`
- live モードは本番 `/api/chat` に短い架空 fixture を送信し、SSE の `text` / `citation` / `done.usage` を集約する。外部 API 送信と課金を伴うため、通常は明示的な実行判断の後に1件から実行する

### Lighthouse / Core Web Vitals (Production)

[`lighthouse-2026-04-28.md`](./lighthouse-2026-04-28.md) — 本番 URL を Lighthouse 13.0.1 / Edge headless で再計測。desktop 99 / 95 / 100 / 100、mobile 89 / 95 / 100 / 100。
[`mobile-performance-analysis-2026-04-28.md`](./mobile-performance-analysis-2026-04-28.md) — mobile Performance 89 の原因分析。主な制約は TBT 410ms、main-thread 1.3s、JS execution 0.5s。

### a11y 検査

確認済み:

- Playwright 5ブラウザmatrixで、認証ゲート / SSEモック / 引用クリック / 429表示を確認
- Lighthouse Accessibility: 95
- [`axe-core-2026-04-29.json`](./axe-core-2026-04-29.json) — login / 認証後空状態 / 回答+引用表示状態で critical / serious 違反 0
- 44pxタッチターゲット、`htmlFor` 関連付け、引用元リストbutton化を実装済み

### E2E (Playwright)

CI artifact `playwright-report-{browser}` から最新 5 ブラウザ (Chromium / Firefox / WebKit / mobile-chrome / mobile-safari) のレポートを取得可能。

### Production smoke

- [`production-smoke-2026-04-29.md`](./production-smoke-2026-04-29.md) — Cloudflare Workers 本番 URL の `HEAD /` 200 とブラウザ描画後のアクセスキー入力画面を確認。live AI API は呼ばない。
- [`production-smoke-2026-04-28.md`](./production-smoke-2026-04-28.md) — Cloudflare Workers 本番 URL の `GET /` 200 と `/api/auth` cookie 発行を確認。
- [`live-ai-smoke-2026-04-28.md`](./live-ai-smoke-2026-04-28.md) — 本番 `/api/chat` の Anthropic-backed live smoke を1件実行。
- [`release-baseline-2026-04-29.md`](./release-baseline-2026-04-29.md) — 公開URL / local verification / production evidence のpoint-in-time snapshot。
- [`deployment-2026-04-29.md`](./deployment-2026-04-29.md) — Cloudflare Workers deploy のpoint-in-time log。
- [`deployment-2026-04-28.md`](./deployment-2026-04-28.md) — Cloudflare Workers deploy Version ID と deploy後 smoke。

### Abuse protection

- [`abuse-protection-2026-04-28.md`](./abuse-protection-2026-04-28.md) — `/api/auth` / `/api/chat` のアクセス制御、Cloudflare Rate Limiting binding、cost guard、残存リスクを整理。

### License inventory

- [`license-inventory-2026-04-29.json`](./license-inventory-2026-04-29.json) — `package-lock.json` とインストール済み `node_modules` の package metadata から 519 packages 分の license を集計。外部サービス送信なし。

### Secret scan

- `scripts/check-secrets.sh` をCI quality-gateで実行し、公開してよいsecret prefixの最小セットを検査します。

## 第三者確認での使い方

1. このフォルダの各ファイルを Public GitHub の URL から直接参照可能 (本リポは Public 設定前提)
2. `dependency-audit-*.md` で moderate 残留の根拠を確認
3. `eval-result-*.json` で LLM 出力品質の自動評価ロジックと結果を確認
4. CI のグリーン状況 (`.github/workflows/ci.yml` quality-gate / e2e matrix / deploy) で機械検証の実行ログを確認

## 不在 / 後追いの項目

- 特になし。citation raw payload の drop count は evidence-only utility / unit test で確認済み。次回の手動 live eval で production JSON に snapshot を追加する。

## 関連変更

- `dependency-audit-2026-04-27.md` 追加
- `eval` 関連: `evaluators.ts` + `evaluators.test.ts` + `sample-cases.json` + `runner.mjs` + `sse-utils.mjs` + `eval-result-2026-04-27.json` 追加
- 本 README で `docs/evidence/` 集約インデックスを公開
