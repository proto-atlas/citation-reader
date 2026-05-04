# Citation Quality Evidence

Date: 2026-04-29

## Sources

- Live eval result: [`eval-result-2026-04-28.json`](./eval-result-2026-04-28.json)
- Eval functions: [`../../eval/evaluators.ts`](../../eval/evaluators.ts)
- Citation runtime validation tests: [`../../src/lib/citations.test.ts`](../../src/lib/citations.test.ts)

## Confirmed Live Eval Metrics

| Metric | Result |
|---|---:|
| mode | live |
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

## Citation Validation Coverage

`toCitationLocation` validates raw citation payloads before the UI receives them.
`validateCitationBatch` aggregates evidence-only validation stats for fixture / eval use.

Confirmed by unit tests:

- non-object input returns `null`
- unknown citation `type` returns `null`
- non-string `cited_text` returns `null`
- non-integer `document_index` returns `null`
- negative `document_index` returns `null`
- negative optional location indexes return `null`
- `char_location`, `page_location`, and `content_block_location` are accepted
- `document_title: null` is preserved for SDK compatibility
- unknown future fields are ignored for forward compatibility

## Citation Validation Stats

The app now has an evidence-only stats shape for citation validation:

| Field | Meaning |
|---|---|
| `received` | raw citation payloads inspected |
| `accepted` | payloads normalized to `CitationLocation` and kept |
| `droppedInvalidBounds` | invalid payload shape or invalid char bounds |
| `droppedTextMismatch` | `cited_text` not found in the referenced document text |
| `droppedMissingDocument` | `document_index` points outside the supplied document list |
| `droppedDuplicate` | duplicate citation signature dropped from the batch |

Unit coverage added on 2026-04-29:

| Check | Result |
|---|---|
| valid citation increments `accepted` | pass |
| malformed payload increments `droppedInvalidBounds` | pass |
| missing document increments `droppedMissingDocument` | pass |
| text mismatch increments `droppedTextMismatch` | pass |
| duplicate citation increments `droppedDuplicate` | pass |
| out-of-document char range increments `droppedInvalidBounds` | pass |

## Interpretation

The current release verifies that the live `/api/chat` path can return a streamed answer with at least one normalized citation and no eval errors.
The eval layer also checks Markdown leakage, answer language, accepted citation count, duplicate citation rate, and evidence-only citation validation stats.

Raw invalid citation payloads are intentionally not exposed to the client.
Raw invalid citation diagnostics are kept in tests and evidence-only utilities, not in end-user UI.

## Follow-Up Candidate

Re-run the manual live eval after the next production deploy so `eval-result-YYYY-MM-DD.json` includes the new `citationValidationStats` snapshot.
