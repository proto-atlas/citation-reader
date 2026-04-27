/**
 * Cloudflare Workers Rate Limiting binding wrapper。
 *
 * in-memory `rate-limit.ts` の
 * per-isolate 制約 (最悪 N × MAX_REQUESTS まで通る) を解消する。
 *
 * 動作モード:
 *   1. Cloudflare Workers 本番環境: `getCloudflareContext().env.RATE_LIMITER` が
 *      存在し、`limit({ key })` 経由で isolate 跨ぎの sliding window を取得できる
 *   2. dev / Vitest / binding 未設定環境: binding が undefined なので、in-memory
 *      `checkRateLimit` (rate-limit.ts) に自動 fallback する
 *
 * 上位 (route.ts) は `checkRateLimitFromContext(...)` を呼ぶだけで、本番 / dev の
 * 切替を意識しなくてよい。
 *
 * binding 設定: `wrangler.jsonc` の `unsafe.bindings` で type=ratelimit /
 * simple.limit=10 / simple.period=60 を宣言済 (本コミットで追加)。
 * 実 deploy 時は Cloudflare Dashboard で実 namespace_id に差し替える必要がある。
 */

import { checkRateLimit, type RateLimitResult } from './rate-limit';

/**
 * Cloudflare Rate Limiting binding API のミニマル型。
 * 本物の SDK 型を直接参照すると build-time に Workers 型が必要になるため、
 * 必要部分だけ手書きで宣言。
 */
interface CloudflareRateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

/**
 * 任意の Cloudflare-like env オブジェクトから RATE_LIMITER binding を取り出す。
 * binding 不在 / 型不一致時は null を返し、呼び出し側は in-memory fallback する。
 */
function pickRateLimiter(env: unknown): CloudflareRateLimiterBinding | null {
  if (!env || typeof env !== 'object') return null;
  const candidate = (env as Record<string, unknown>).RATE_LIMITER;
  if (!candidate || typeof candidate !== 'object') return null;
  const limit = (candidate as { limit?: unknown }).limit;
  if (typeof limit !== 'function') return null;
  return candidate as CloudflareRateLimiterBinding;
}

/**
 * binding がある環境では binding 経由で判定、なければ in-memory に fallback。
 *
 * @param env - getCloudflareContext().env 等の Cloudflare bindings コンテナ
 * @param ip - getClientIp() の戻り値
 * @returns RateLimitResult。binding 経由のとき remaining は不明なので 0 を返す
 *          (上位は allowed と retryAfterSeconds だけ参照する設計)
 */
export async function checkRateLimitFromContext(
  env: unknown,
  ip: string,
): Promise<RateLimitResult> {
  const binding = pickRateLimiter(env);
  if (!binding) {
    // dev / Vitest / binding 未設定: in-memory に fallback
    return checkRateLimit(ip);
  }
  try {
    const result = await binding.limit({ key: ip });
    if (result.success) {
      return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
    }
    // binding 側で blocked。Cloudflare Rate Limiting binding は retry-after を
    // 直接返さないため、wrangler.jsonc の simple.period (60s) を上限とした
    // 概算値を使う (sliding window の最大残時間)。
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  } catch (err) {
    // binding 呼び出しが失敗した場合は安全側で in-memory に fallback して
    // サービス継続を優先 (binding alpha / 一時的障害時の影響を抑える)。
    console.error('[rate-limit-binding] limit() failed, falling back to in-memory:', err);
    return checkRateLimit(ip);
  }
}
