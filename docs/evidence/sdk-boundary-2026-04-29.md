# SDK境界の検証記録 (2026-04-29)

このファイルは、Anthropic SDK stream eventの型境界を `/api/chat` route本体から分離した変更の特定時点の記録です。

## 対象

- Project: `citation-reader`
- 確認種別: SDK boundary / TypeScript quality
- 公開上の目的: route本体がAnthropic SDKの生stream eventを直接castし続ける状態を避け、外部SDK境界をadapterに閉じる
- 実API呼び出し: 実施なし
- secret記録: なし

## 変更内容

- `src/lib/anthropic-citation-stream.ts`を追加
  - `createAnthropicCitationStreamClient`
  - `buildCitationStreamParams`
  - `toChatStreamEvents`
  - `toDoneUsage`
- `src/lib/anthropic-citation-stream.test.ts`を追加
- `src/app/api/chat/route.ts`を更新
  - route本体からAnthropic SDKの生event変換を削除
  - route本体から `@typescript-eslint/no-unsafe-*` disableを削除
  - routeはdomain-level `ChatStreamEvent` だけを送出

## 検証

| 確認項目 | 結果 |
|---|---|
| `node node_modules\typescript\bin\tsc --noEmit` | 通過 |
| `node node_modules\vitest\vitest.mjs run src/lib/anthropic-citation-stream.test.ts src/app/api/chat/route.test.ts src/lib/citations.test.ts --passWithNoTests --maxWorkers=1` | 3 files / 29 tests通過 |
| `node node_modules\eslint\bin\eslint.js src/app/api/chat/route.ts src/lib/anthropic-citation-stream.ts src/lib/anthropic-citation-stream.test.ts` | 通過 |
| Search `src/app/api/chat/route.ts` for `no-unsafe` / `eslint-disable` | no matches |

## 解釈

この記録は、Anthropic SDK自体が将来のすべてのevent shapeまで完全に型付けされている、と主張するものではありません。
主張範囲は次の通りです。

- SDK固有のstream event処理を`src/lib/anthropic-citation-stream.ts`へ分離しています。
- `/api/chat` routeから以前のunsafe lint suppressionを削除しています。
- text、citation、usage conversionはunit testで確認しています。

## 残る制約

実APIの引用品質は外部AI API呼び出しと課金を伴う可能性があるため、引き続き手動確認と評価で扱います。
fixtureベースのテストでは、外部AI APIを呼ばずにevent変換とcitation validationの挙動を検証します。
