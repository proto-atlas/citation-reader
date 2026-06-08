# 検証記録

最終更新: 2026-04-29

確認時に使えるように、citation-readerの品質 / セキュリティ / a11y / 依存関係 / LLM出力品質の **機械検証可能な証跡** を集約したフォルダ。

## 集約済の証跡

### 依存関係audit

- [`dependency-audit-2026-06-04.md`](./dependency-audit-2026-06-04.md): `npm audit --audit-level=high --json` の再計測結果。0 vulnerabilities
- [`npm-audit-2026-06-04.json`](./npm-audit-2026-06-04.json): 2026-06-04 のaudit JSON
- [`dependency-audit-2026-04-27.md`](./dependency-audit-2026-04-27.md): 過去のnpm audit `moderate` 6 件の出自表 / 試行 4 案の却下根拠 / アップストリーム追跡 / 確認時の扱い
- [`dependency-audit-2026-04-28.md`](./dependency-audit-2026-04-28.md): 本番公開後の `npm audit --audit-level=high --json` 再計測結果。high / critical 0 件、moderate 6 件
- [`dependency-advisory-map-2026-04-29.md`](./dependency-advisory-map-2026-04-29.md): 2026-04-29 時点の `moderate` 6 件について、package / path / exposure / decisionを整理
- 再実行: `npm audit --audit-level=high` (CI quality-checkで実行、`high` 以上は 0 件)

### LLM出力品質評価

- [`eval-result-2026-04-28.json`](./eval-result-2026-04-28.json): `eval/runner.mjs --live --limit=1` の最新実行結果。`ja-edge-summary` がstatus 200、引用 1 件で通過
- [`eval-result-2026-04-29.json`](./eval-result-2026-04-29.json): `eval/runner.mjs` の外部APIなし実行結果。外部AI APIを呼ばず、3 fixtureの読み込みとevidence書き出し経路を確認
- [`live-ai-check-2026-04-28.md`](./live-ai-check-2026-04-28.md): 本番 `/api/chat` の 実API確認の要約。secretを出力せず、短い架空fixtureで実行
- [`citation-quality-2026-04-29.md`](./citation-quality-2026-04-29.md): 実API評価 のcitationCount / duplicateRate / errorsと 検証記録用のcitation validation statsの確認範囲を整理
- [`sdk-boundary-2026-04-29.md`](./sdk-boundary-2026-04-29.md): Anthropic SDK stream event処理をroute本体からadapterへ分離し、route本体のunsafe lint suppressionを削除した証跡
- 評価関数本体: [`../../eval/evaluators.ts`](../../eval/evaluators.ts): Markdown混入 / 言語一致 / 引用件数・重複率の 3 軸を純関数で実装、Vitestで 23 件カバー
- 再実行: `npm run eval` (外部APIなしモード)
- 実API再実行: `BASE_URL=https://citation-reader.atlas-lab.workers.dev ACCESS_KEY=... npm run eval -- --live --limit=1`
- 実APIモードは本番 `/api/chat` に短い架空fixtureを送信し、SSEの `text` / `citation` / `done.usage` を集約する。外部API送信と課金を伴うため、通常は明示的な実行判断の後に1件から実行する

### Lighthouse / Core Web Vitals（本番）

[`lighthouse-2026-04-28.md`](./lighthouse-2026-04-28.md): 本番URLをLighthouse 13.0.1 / Edge headlessで再計測。desktop 99 / 95 / 100 / 100、mobile 89 / 95 / 100 / 100。
[`mobile-performance-analysis-2026-04-28.md`](./mobile-performance-analysis-2026-04-28.md): mobile Performance 89 の原因分析。主な制約はTBT 410ms、main-thread 1.3s、JS execution 0.5s。

### a11y検査

確認済み:

- Playwright 5ブラウザmatrixで、認証画面 / SSE応答置き換え / 引用クリック / 429表示を確認
- Lighthouse Accessibility: 95
- [`axe-core-2026-04-29.json`](./axe-core-2026-04-29.json): login / 認証後空状態 / 回答+引用表示状態でcritical / serious違反 0
- 44pxタッチターゲット、`htmlFor` 関連付け、引用元リストbutton化を実装済み

### E2E（Playwright）

CI artifact `playwright-report-{browser}` から最新 5 ブラウザ (Chromium / Firefox / WebKit / mobile-chrome / mobile-safari) のレポートを取得可能。

### 公開URL確認

- [`production-check-2026-04-29.md`](./production-check-2026-04-29.md): Cloudflare Workers本番URLの `HEAD /` 200 とブラウザ描画後のアクセスキー入力画面を確認。実APIは呼ばない。
- [`production-check-2026-04-28.md`](./production-check-2026-04-28.md): Cloudflare Workers本番URLの `GET /` 200 と `/api/auth` cookie発行を確認。
- [`live-ai-check-2026-04-28.md`](./live-ai-check-2026-04-28.md): 本番 `/api/chat` のAnthropic APIを使った実API確認を1件実行。
- [`release-baseline-2026-04-29.md`](./release-baseline-2026-04-29.md): 公開URL、ローカル検証、公開URLの検証記録をまとめた特定時点の記録。
- [`deployment-2026-04-29.md`](./deployment-2026-04-29.md): Cloudflare Workers deployの特定時点の記録。
- [`deployment-2026-04-28.md`](./deployment-2026-04-28.md): Cloudflare Workers deploy Version IDとdeploy後の確認。

### 濫用対策

- [`abuse-protection-2026-04-28.md`](./abuse-protection-2026-04-28.md): `/api/auth` / `/api/chat` のアクセス制御、Cloudflare Rate Limiting binding、コスト保護、残存リスクを整理。

### ライセンス一覧

- [`license-inventory-2026-04-29.json`](./license-inventory-2026-04-29.json): `package-lock.json` とインストール済み `node_modules` のpackage metadataから 519 packages分のlicenseを集計。外部サービス送信なし。

### secret scan結果

- `scripts/check-secrets.sh` をCI quality-checkで実行し、公開してよいsecret prefixの最小セットを検査します。

## 確認時の使い方

1. このフォルダの各ファイルをPublic GitHubのURLから直接参照可能 (本リポはPublic設定前提)
2. `dependency-audit-2026-06-04.md` で現在の依存監査結果を確認し、過去の `moderate` 記録は履歴として参照
3. `eval-result-*.json` でLLM出力品質の自動評価ロジックと結果を確認
4. CIのグリーン状況 (`.github/workflows/ci.yml` quality-check / e2e matrix / deploy) で機械検証の実行ログを確認

## 不在 / 後追いの項目

- 特になし。citation raw payloadのdrop countは 検証記録用utility / unit testで確認済み。次回の手動 実API評価 でproduction JSONにsnapshotを追加する。

## 関連変更

- `dependency-audit-2026-04-27.md` 追加
- `eval` 関連: `evaluators.ts` + `evaluators.test.ts` + `sample-cases.json` + `runner.mjs` + `sse-utils.mjs` + `eval-result-2026-04-27.json` 追加
- 本READMEで `docs/evidence/` 集約インデックスを公開
