# 検証記録の対応表

## 対象

- Project: `citation-reader`
- 公開URL: https://citation-reader.atlas-lab.workers.dev
- Source: https://github.com/proto-atlas/citation-reader
- 検証記録は特定時点の記録であり、最新HEADの状態を常に示すものではありません。
- 確認時は対象commitとCI runを指定してください。

## 対応表

| 確認内容 | 検証記録 | commit | 結果 |
|---|---|---:|---|
| release検証はlint、typecheck、coverage、build、E2E、publish scan、audit、公開URLの検証記録を対象にする | [release-baseline-2026-04-29.md](./release-baseline-2026-04-29.md) | ファイル参照 | 成功記録 |
| 実API確認は短い架空fixtureで実行し、secretを記録しない | [live-ai-check-2026-04-28.md](./live-ai-check-2026-04-28.md) / [eval-result-2026-04-28.json](./eval-result-2026-04-28.json) | ファイル参照 | 成功記録 |
| 引用品質の記録を利用者向けUIとは別に残す | [citation-quality-2026-04-29.md](./citation-quality-2026-04-29.md) | ファイル参照 | accepted / dropの集計をunit testと評価スクリプトで確認 |
| Anthropic SDKのstream変換をroute本体から分離する | [sdk-boundary-2026-04-29.md](./sdk-boundary-2026-04-29.md) | ファイル参照 | adapter分割後、routeに `no-unsafe` のlint抑制なし |
| アクセス制御、rate limit、コスト保護を記録する | [abuse-protection-2026-04-28.md](./abuse-protection-2026-04-28.md) | ファイル参照 | 制御内容と制約を記録 |
| 公開URL確認とdeploy記録がある | [production-check-2026-04-29.md](./production-check-2026-04-29.md) / [deployment-2026-04-29.md](./deployment-2026-04-29.md) | ファイル参照 | 成功記録 |
| Lighthouseのデスクトップ/モバイルのスコアを記録した | [lighthouse-2026-04-28.md](./lighthouse-2026-04-28.md) / [mobile-performance-analysis-2026-04-28.md](./mobile-performance-analysis-2026-04-28.md) | ファイル参照 | desktop 99/95/100/100, mobile 89/95/100/100 |
| axe-coreの確認結果を記録した | [axe-core-2026-04-29.json](./axe-core-2026-04-29.json) | ファイル参照 | critical / serious 0 |
| 依存脆弱性が残っていないことを確認した | [dependency-audit-2026-06-04.md](./dependency-audit-2026-06-04.md) / [npm-audit-2026-06-04.json](./npm-audit-2026-06-04.json) | ファイル参照 | 0 vulnerabilities |
| license inventoryをローカルで生成した | [license-inventory-2026-04-29.json](./license-inventory-2026-04-29.json) | ファイル参照 | package license snapshot |

## 公開範囲とアクセスキー範囲

| 範囲 | キー必須 | 補足 |
|---|---:|---|
| スクリーンショット | 不要 | 静的な画面記録。 |
| README / evidence | 不要 | 公開文書と特定時点の検証記録。 |
| `/api/auth` | 不要 | 実Q&Aの前に必要。誤ったキーはrate limit対象。 |
| `/api/chat` 実Q&A | 必要 | アクセスキーとrate limitで保護。 |
| 実API評価 | 手動確認 | 短い架空fixtureのみ。通常CIには含めない。 |

## 壊れやすいケースと扱い

| ケース | 実装上の扱い | 見える結果 |
|---|---|---|
| アクセスキーなしでQ&Aを呼ぶ | `/api/auth` と `/api/chat` を分けて制限する | メインUIへ進めない |
| 引用IDが原文範囲と対応しない | adapterで引用候補を検証し、UI向けdiagnosticsとは分ける | 不採用理由を検証記録で追える |
| PDF抽出が失敗する | クライアント側抽出に閉じ、失敗時は入力を促す | サーバーへ不要なPDF本文を送らない |
| 回答生成を途中で止める | UIの中断を `AbortSignal` 経由でstreamに伝える | 途中で表示を止められる |
| Anthropic SDKのevent形状が変わる | SDK処理をadapterに分離する | route本体ではなくadapter testで影響を確認できる |

## 既知の制約

| 制約 | 重要度 | 現在の扱い | 運用時の追加案 |
|---|---|---|---|
| 実API呼び出しはアクセスキーで保護する | Medium | スクリーンショットと検証記録では、外部AI課金なしで主要UXを確認できる。 | キー共有が負担になる場合は短いデモ動画を用意する。 |
| 引用品質は事実性を完全に示すものではない | Medium | runtime validationと評価スクリプトでaccepted / drop reasonの件数を記録する。raw diagnosticsはtests / evidenceに残し、利用者向けUIには出さない。 | deploy後に手動の実API評価を再実行し、production JSONに新しい集計を残す。 |
| Anthropic SDKのevent shapeは変わる可能性がある | Medium | SDK stream処理をadapterに分離し、対象unit testで確認する。 | SDK更新後にadapter testを再実行する。 |
| Rate Limiting bindingは濫用対策であり、厳密な全体利用量の会計ではない | Medium | アクセスキー、scoped rate limits、cache-assisted limiter、Anthropic spend limitを組み合わせる。 | より厳密にする場合はDurable Objectsなどの集中管理を追加する。 |
| 過去のmoderate advisory記録が残る | Low | 2026-04-27 から 2026-04-29 の記録は履歴として残す。2026-06-04 時点のauditは 0 vulnerabilities。 | 依存更新後は新しいaudit記録を追加する。 |

## 実施していないこと

- 認証情報の推測。
- 負荷試験。
- 制御なしの実API呼び出し。
- 非公開文書や実ユーザー文書の入力。
- 安全な低い閾値を設定しない状態でのproduction rate-limit連打試験。
