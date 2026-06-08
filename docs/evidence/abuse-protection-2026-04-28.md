# 濫用対策の検証記録

日付: 2026-04-28

## 対象

この文書は、Anthropicを使う `/api/chat` endpointの誤用や過剰利用をcitation-readerがどう抑えているかを記録します。

## 保護レイヤー

| レイヤー | 実装 | 確認方法 |
|---|---|---|
| Access gate | Shared `ACCESS_PASSWORD` sent as `Authorization: Bearer ...` for compatibility | `src/lib/auth.test.ts` |
| Short session | HMAC-signed `__Host-` session cookie after `/api/auth` 成功 | `src/lib/session.test.ts`, `docs/evidence/production-check-2026-04-28.md` |
| Auth endpoint rate limit | `/api/auth` checks `checkRateLimitFromContext` before password validation | `src/app/api/auth/route.ts`, `src/lib/rate-limit-binding.test.ts` |
| Chat endpoint rate limit | `/api/chat` checks `checkRateLimitFromContext` before Anthropic call | `src/app/api/chat/route.ts`, `src/lib/rate-limit-binding.test.ts` |
| Cloudflare binding | `wrangler.jsonc` defines `RATE_LIMITER` with `limit=10`, `period=60` | `wrangler.jsonc` |
| Edge cache assist | Workers Cache API stores a hashed IP bucket to stop same-edge bursts when binding is delayed or unavailable | `src/lib/rate-limit-binding.ts`, `src/lib/rate-limit-binding.test.ts` |
| Local fallback | dev / test fallback uses in-memory limiter when binding / Cache API is unavailable | `src/lib/rate-limit.test.ts`, `src/lib/rate-limit-binding.test.ts` |
| Cost guard | Anthropic client uses `maxRetries: 0` to avoid retry-driven duplicate cost | `src/app/api/chat/route.ts` |
| Abort guard | `enable_request_signal` and `anthropicStream.abort()` stop work after client disconnect | `wrangler.jsonc`, `src/app/api/chat/route.ts` |
| Token cap | `/api/chat` uses `max_tokens: 1024` | `src/app/api/chat/route.ts` |

## 検証

2026-04-28 のローカル検証:

- `npm run typecheck`: 通過
- `npm run lint`: 通過
- `npm run test`: 12 files / 134 tests通過
- `npm run test:coverage`: 通過
- `npm run build`: 通過

対象テスト:

- `src/lib/auth.test.ts`: 11 tests通過
- `src/lib/rate-limit.test.ts`: in-memory limiter behavior
- `src/lib/rate-limit-binding.test.ts`: Cloudflare binding成功 / blocked / fallback behavior
- `e2e/chat.spec.ts`: mocked 429 response is surfaced to the user as a safe rate-limit message

本番確認の記録:

- [`production-check-2026-04-28.md`](./production-check-2026-04-28.md): `/api/auth` が200を返し、有効なアクセスキーでsession cookieを設定することを確認
- [`live-ai-check-2026-04-28.md`](./live-ai-check-2026-04-28.md): 短い架空fixtureで `/api/chat` のAnthropic実APIリクエストを1件完了

## 本番429 burst確認

2026-04-29 に、Anthropic APIを呼ばない誤認証リクエストだけで `/api/auth` を12回送信した。

確認済み:

- binding単独の公開状態では 12回とも401で、429は観測されなかった。
- そのため、Workers Cache API補助リミッターを追加した。
- 修正後の本番burst再検証では、12回中11回目と12回目で429を確認した。詳細は `production-check-2026-04-28.md` に記録した。

## 残存リスク

Cloudflare Rate Limiting bindingとWorkers Cache API補助はリクエスト抑制には使えますが、課金管理用の強整合なglobal counterではありません。
このアプリでは、アクセス制御、短期session、token上限、abort処理、Anthropic account spend limitsと組み合わせた多層防御として扱います。

## 結論

公開AI endpointは、未認証で開いたAPIではありません。
アクセスキーまたは有効な短期sessionを要求し、本番ではCloudflare Rate Limiting bindingとWorkers Cache API補助で保護します。
