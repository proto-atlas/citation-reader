# release基準の検証記録

日付: 2026-04-29

## 目的

公開URLのrelease状態を、特定時点の検証記録として残します。このファイルは、最新のrepository HEADと一致することを主張しません。

## リポジトリ

- Project: `citation-reader`
- Branch: `main`
- 検証範囲: source、tests、public evidence、GitHub Actions、deployed URL
- commit参照: 正確なsource revisionはGitHubのcommit viewとActions runで確認します。
- 補足: code verification後に文書だけのevidence commitでpublic repositoryを更新することがあるため、このファイルには自己参照になる固定HEAD値を埋め込みません。

## 公開URL

- URL: `https://citation-reader.atlas-lab.workers.dev`
- Method: `HEAD`
- Status: `200`
- Server: `cloudflare`

## ローカル検証

| コマンド | 結果 | 補足 |
|---|---|---|
| `npm run lint` | 通過 | ESLint and Prettier check passed |
| `npm run typecheck` | 通過 | `tsc --noEmit`, exit 0 |
| `npm run test:coverage` | 通過 | 12 files / 142 tests通過 |
| `npm run build` | 通過 | Next.js 16.2.4 webpack build succeeded |
| `npm run e2e -- --project=chromium --workers=1` | 通過 | 8 / 8 Playwright tests通過 |
| `npm audit --audit-level=high` | 通過 | high / critical: 0, moderate: 6 |
| `git diff --check` | 通過 | no whitespace errors |

coverage summary:

| Metric | Value |
|---|---:|
| Statements | 82.80% |
| Branches | 82.19% |
| Functions | 86.36% |
| Lines | 85.04% |

## 本番確認の記録

- `/api/chat` 実API評価: `eval-result-2026-04-28.json`, status 200, citation 1, errors 0
- mock eval path check: `eval-result-2026-04-29.json`, mode `mock`, 3 fixtures loaded without external AI API calls
- `/api/chat` 実API確認の要約: `live-ai-check-2026-04-28.md`
- Abuse protection: `abuse-protection-2026-04-28.md`
- Production static route check: `production-check-2026-04-29.md`
- Deployment evidence: `deployment-2026-04-29.md`
- Post-deploy rate limit burst snapshot: `production-check-2026-04-28.md`
- Dependency audit: `dependency-audit-2026-04-28.md`
- License inventory: `license-inventory-2026-04-29.json`

## 実行環境の補足

sandbox環境のVitest、Next.js build、Playwright実行は `spawn EPERM` で失敗しました。
同じコマンドを通常の実行権限で再実行し、passしました。
これはプロジェクトの失敗ではなく、実行環境の制約として記録します。

このWindows環境にはFirefox / WebKit / mobile-safariのブラウザバイナリがなかったため、ローカルのfull-browser Playwright実行はrelease evidenceとして使っていません。
cross-browser確認の根拠はGitHub Actions E2E matrixです。

## 結論

検証済みのcode commitはdeploy可能で、実API挙動、濫用対策、依存関係状態、公開route確認の公開URL記録があります。
