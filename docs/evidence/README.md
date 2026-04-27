# Evidence (Public 証跡)

最終更新: 2026-04-28

採用評価担当者向けに、citation-reader の品質 / セキュリティ / a11y / 依存関係 / LLM 出力品質の **機械検証可能な証跡** を集約したフォルダ。

## 集約済の証跡

### 依存関係 audit

- [`dependency-audit-2026-04-27.md`](./dependency-audit-2026-04-27.md) — npm audit `moderate` 6 件の出自表 / 試行 4 案の却下根拠 / アップストリーム追跡 / 採用評価上の扱い
- 再実行: `npm audit --audit-level=high` (CI quality-gate でブロッキング、`high` 以上は 0 件保証)

### LLM 出力品質評価

- [`eval-result-2026-04-27.json`](./eval-result-2026-04-27.json) — `eval/runner.mjs --mock` の最新実行結果。3 sample case (ja-edge-summary / en-cost-protection / ja-citation-density) 定義
- 評価関数本体: [`../../eval/evaluators.ts`](../../eval/evaluators.ts) — Markdown 混入 / 言語一致 / 引用件数・重複率の 3 軸を純関数で実装、Vitest で 23 件カバー
- 再実行: `npm run eval` (現在は mock モードのみ。live モードは v0.2 で本番 URL に対して実行、課金 ~$0.05/run 想定)

### Lighthouse / Core Web Vitals (Production)

⏳ 本番 deploy 後に再計測予定。

現状の参照値 (2026-04-26 PageSpeed Insights 計測):
- Performance: 96
- Accessibility: 95
- Best Practices: 96
- SEO: 100

本番 deploy 後の再計測値は `lighthouse-desktop-{date}.json` / `lighthouse-mobile-{date}.json` として本フォルダに追加予定。

### a11y 検査 (axe-core)

⏳ 本番 deploy 後に `axe-result-{date}.json` を追加予定。

確認時点では:
- Auth gate: violations 0
- Main sample: violations 0 (color-contrast 1 件は解消済)

### E2E (Playwright)

⏳ CI artifact `playwright-report-{browser}` から最新 5 ブラウザ (Chromium / Firefox / WebKit / mobile-chrome / mobile-safari) のレポートを取得可能。

### Production smoke

- [`production-smoke-2026-04-28.md`](./production-smoke-2026-04-28.md) — Cloudflare Workers 本番 URL の `GET /` 200 と `/api/auth` cookie 発行を確認。Anthropic API への live smoke は課金と外部 API 送信を伴うため未実施。

### License inventory

⏳ `npx license-checker --json > docs/evidence/license-checker-{date}.json` で生成、本コミット時点では未実行 (live deploy 後に確定)。

### Secret 検出

- `scripts/check-before-publish.mjs` (Node 互換版) を `npm run check:publish` で実行。ローカル用 `_docs/DANGER-WORDS.txt` がある場合はその全パターン、ない場合は公開用 fallback の secret prefix を再帰 grep し、ヒット 0 を CI でも保証 (CI quality-gate に `Check for secret patterns` step)

## 評価担当者の使い方

1. このフォルダの各ファイルを Public GitHub の URL から直接参照可能 (本リポは Public 設定前提)
2. `dependency-audit-*.md` で moderate 残留の根拠を確認
3. `eval-result-*.json` で LLM 出力品質の自動評価ロジックと結果を確認
4. CI のグリーン状況 (`.github/workflows/ci.yml` quality-gate / e2e matrix / deploy) で機械検証の実行ログを確認

## 不在 / 後追いの項目

- Lighthouse 再計測
- axe-core JSON 出力
- License inventory JSON
- LLM live 評価結果 (v0.2 で `eval/runner.mjs --live` 実装後)

これらの不在は意図的であり、次のリリースサイクルで埋める予定。本フォルダは「整いつつある証跡」であり、現時点では依存 audit / eval mock / production smoke が確定済。

## 関連変更

- `dependency-audit-2026-04-27.md` 追加
- `eval` 関連: `evaluators.ts` + `evaluators.test.ts` + `sample-cases.json` + `runner.mjs` + `eval-result-2026-04-27.json` 追加
- 本 README で `docs/evidence/` 集約インデックスを公開
