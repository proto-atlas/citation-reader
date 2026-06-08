# citation品質の確認記録

日付: 2026-04-29

## 参照

- 実API評価result: [`eval-result-2026-04-28.json`](./eval-result-2026-04-28.json)
- eval functions: [`../../eval/evaluators.ts`](../../eval/evaluators.ts)
- citation runtime validation tests: [`../../src/lib/citations.test.ts`](../../src/lib/citations.test.ts)

## 実API評価metricsの確認結果

| Metric | Result |
|---|---:|
| mode | 実API |
| sampleCount | 1 |
| passed | true |
| sample id | `ja-edge-summary` |
| HTTP status | 200 |
| content type | `text/event-stream; charset=utf-8` |
| citationCount | 1 |
| unique cited_text count | 1 |
| duplicateRate | 0 |
| errors | 0 |
| eventCount | 7 |

## citation validationの範囲

`toCitationLocation` はUIへ渡す前にraw citation payloadを検証する。
`validateCitationBatch` はfixture / eval用に、検証記録用のvalidation statsを集計する。

unit testで確認した内容:

- non-object inputは `null` を返す。
- unknown citation `type` は `null` を返す。
- non-string `cited_text` は `null` を返す。
- non-integer `document_index` は `null` を返す。
- negative `document_index` は `null` を返す。
- negative optional location indexesは `null` を返す。
- `char_location`、`page_location`、`content_block_location` は受け付ける。
- SDK互換のため `document_title: null` は保持する。
- 将来追加されるunknown fieldsはforward compatibilityのため無視する。

## citation validation statsの集計

アプリにはcitation validation用のevidence-only stats shapeを用意している。

| Field | Meaning |
|---|---|
| `received` | raw citation payloads inspected |
| `accepted` | payloads normalized to `CitationLocation` and kept |
| `droppedInvalidBounds` | invalid payload shape or invalid char bounds |
| `droppedTextMismatch` | `cited_text` not found in the referenced document text |
| `droppedMissingDocument` | `document_index` points outside the supplied document list |
| `droppedDuplicate` | duplicate citation signature dropped from the batch |

2026-04-29 に追加したunit coverage:

| Check | Result |
|---|---|
| valid citation increments `accepted` | 通過 |
| malformed payload increments `droppedInvalidBounds` | 通過 |
| missing document increments `droppedMissingDocument` | 通過 |
| text mismatch increments `droppedTextMismatch` | 通過 |
| duplicate citation increments `droppedDuplicate` | 通過 |
| out-of-document char range increments `droppedInvalidBounds` | 通過 |

## 読み方

この時点のreleaseでは、実API `/api/chat` pathが、1件以上のnormalized citationを含むstreamed answerを返し、eval errorsが0であることを確認している。
eval layerでは、Markdown leakage、answer language、accepted citation count、duplicate citation rate、検証記録用のcitation validation statsも確認している。

無効なcitation payloadの生データは、クライアントへ返さない。
無効なcitation diagnosticsの生データはtestsとevidence-only utilitiesにだけ残し、end-user UIには出さない。

## 次回確認候補

次回本番デプロイ後に手動の実API評価を再実行し、`eval-result-YYYY-MM-DD.json` に新しい `citationValidationStats` snapshotを含める。
