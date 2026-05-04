# Abuse Protection Evidence

Date: 2026-04-28

## Scope

This document records how citation-reader limits accidental or abusive use of the Anthropic-backed `/api/chat` endpoint.

## Protection Layers

| Layer | Implementation | Verified by |
|---|---|---|
| Access gate | Shared `ACCESS_PASSWORD` sent as `Authorization: Bearer ...` for compatibility | `src/lib/auth.test.ts` |
| Short session | HMAC-signed `__Host-` session cookie after `/api/auth` success | `src/lib/session.test.ts`, `docs/evidence/production-smoke-2026-04-28.md` |
| Auth endpoint rate limit | `/api/auth` checks `checkRateLimitFromContext` before password validation | `src/app/api/auth/route.ts`, `src/lib/rate-limit-binding.test.ts` |
| Chat endpoint rate limit | `/api/chat` checks `checkRateLimitFromContext` before Anthropic call | `src/app/api/chat/route.ts`, `src/lib/rate-limit-binding.test.ts` |
| Cloudflare binding | `wrangler.jsonc` defines `RATE_LIMITER` with `limit=10`, `period=60` | `wrangler.jsonc` |
| Edge cache assist | Workers Cache API stores a hashed IP bucket to stop same-edge bursts when binding is delayed or unavailable | `src/lib/rate-limit-binding.ts`, `src/lib/rate-limit-binding.test.ts` |
| Local fallback | dev / test fallback uses in-memory limiter when binding / Cache API is unavailable | `src/lib/rate-limit.test.ts`, `src/lib/rate-limit-binding.test.ts` |
| Cost guard | Anthropic client uses `maxRetries: 0` to avoid retry-driven duplicate cost | `src/app/api/chat/route.ts` |
| Abort guard | `enable_request_signal` and `anthropicStream.abort()` stop work after client disconnect | `wrangler.jsonc`, `src/app/api/chat/route.ts` |
| Token cap | `/api/chat` uses `max_tokens: 1024` | `src/app/api/chat/route.ts` |

## Verification

Local verification on 2026-04-28:

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test`: 12 files / 134 tests pass
- `npm run test:coverage`: pass
- `npm run build`: pass

Focused tests:

- `src/lib/auth.test.ts`: 11 tests pass
- `src/lib/rate-limit.test.ts`: in-memory limiter behavior
- `src/lib/rate-limit-binding.test.ts`: Cloudflare binding success / blocked / fallback behavior
- `e2e/chat.spec.ts`: mocked 429 response is surfaced to the user as a safe rate-limit message

Production evidence:

- [`production-smoke-2026-04-28.md`](./production-smoke-2026-04-28.md): `/api/auth` returns 200 and sets a session cookie with a valid access key
- [`live-ai-smoke-2026-04-28.md`](./live-ai-smoke-2026-04-28.md): `/api/chat` completes one live Anthropic-backed request with a short fictional fixture

## Production 429 Burst Check

2026-04-29 に、Anthropic APIを呼ばない誤認証リクエストだけで `/api/auth` を12回送信した。

確認済み:

- binding単独の公開状態では 12回とも401で、429は観測されなかった。
- そのため、Workers Cache API補助リミッターを追加した。
- 修正後の本番burst再検証では、12回中11回目と12回目で429を確認した。詳細は `production-smoke-2026-04-28.md` に記録した。

## Residual Risk

Cloudflare Rate Limiting binding and Workers Cache API assist are suitable for request throttling, but they are not billing-grade global counters.
The app treats them as layers in a defense-in-depth setup together with access gating, short sessions, token caps, abort handling, and Anthropic account spend limits.

## Conclusion

The public AI endpoint is not an open unauthenticated API.
It requires an access key or valid short session and is protected by Cloudflare Rate Limiting binding plus Workers Cache API assist in production.
