# SDK Boundary Evidence (2026-04-29)

このファイルは、Anthropic SDK stream event の型境界を `/api/chat` route 本体から分離した変更のpoint-in-time logです。

## Scope

- Project: `citation-reader`
- Check type: SDK boundary / TypeScript quality
- Public-facing purpose: route本体がAnthropic SDKの生stream eventを直接castし続ける状態を避け、外部SDK境界をadapterに閉じる
- Live AI call: not performed
- Secrets recorded: none

## What Changed

- Added `src/lib/anthropic-citation-stream.ts`
  - `createAnthropicCitationStreamClient`
  - `buildCitationStreamParams`
  - `toChatStreamEvents`
  - `toDoneUsage`
- Added `src/lib/anthropic-citation-stream.test.ts`
- Updated `src/app/api/chat/route.ts`
  - route本体からAnthropic SDKの生event変換を削除
  - route本体から `@typescript-eslint/no-unsafe-*` disableを削除
  - routeはdomain-level `ChatStreamEvent` だけを送出

## Verification

| Check | Result |
|---|---|
| `node node_modules\typescript\bin\tsc --noEmit` | pass |
| `node node_modules\vitest\vitest.mjs run src/lib/anthropic-citation-stream.test.ts src/app/api/chat/route.test.ts src/lib/citations.test.ts --passWithNoTests --maxWorkers=1` | 3 files / 29 tests pass |
| `node node_modules\eslint\bin\eslint.js src/app/api/chat/route.ts src/lib/anthropic-citation-stream.ts src/lib/anthropic-citation-stream.test.ts` | pass |
| Search `src/app/api/chat/route.ts` for `no-unsafe` / `eslint-disable` | no matches |

## Interpretation

This does not claim the Anthropic SDK itself is fully typed for every future event shape.
The claim is narrower:

- SDK-specific stream event handling is isolated in `src/lib/anthropic-citation-stream.ts`.
- `/api/chat` route no longer carries the previous unsafe lint suppression.
- Text, citation, and usage conversion are covered by unit tests.

## Remaining Constraint

Live citation quality is still intentionally evaluated via manual smoke/eval because it can call an external AI API and may incur cost.
The fixture-based tests verify event conversion and citation validation behavior without calling external AI APIs.
