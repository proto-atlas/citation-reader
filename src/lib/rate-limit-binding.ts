/**
 * Cloudflare Workers Rate Limiting binding wrapper。
 *
 * in-memory `rate-limit.ts` の
 * per-isolate 制約 (最悪 N × MAX_REQUESTS まで通る) を解消する。
 *
 * 動作モード:
 *   1. Cloudflare Workers 本番環境: `getCloudflareContext().env.RATE_LIMITER` が
 *      存在し、`limit({ key })` 経由で isolate 跨ぎの sliding window を取得できる
 *   2. Workers Cache API: binding が許可した後、または binding が無い本番環境で、
 *      同一 edge 内の burst を補助的に抑える
 *   3. dev / Vitest / binding / Cache API 未設定環境: in-memory
 *      `checkRateLimit` (rate-limit.ts) に自動 fallback する
 *
 * 上位 (route.ts) は `checkRateLimitFromContext(...)` を呼ぶだけで、本番 / dev の
 * 切替を意識しなくてよい。
 *
 * binding 設定: `wrangler.jsonc` の `ratelimits` で
 * name=RATE_LIMITER / simple.limit=10 / simple.period=60 を宣言済。
 * namespace_id は Cloudflare アカウント内で一意な正整数文字列を使う。
 */

import {
  checkRateLimit,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitResult,
} from './rate-limit';

/**
 * Cloudflare Rate Limiting binding API のミニマル型。
 * 本物の SDK 型を直接参照すると build-time に Workers 型が必要になるため、
 * 必要部分だけ手書きで宣言。
 */
interface CloudflareRateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

type EdgeCacheLimiter = (ip: string, now: number) => Promise<RateLimitResult | null>;

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
  now: number = Date.now(),
  edgeCacheLimiter: EdgeCacheLimiter = checkEdgeCacheRateLimit,
): Promise<RateLimitResult> {
  const binding = pickRateLimiter(env);
  if (!binding) {
    const edgeResult = await edgeCacheLimiter(ip, now);
    return edgeResult ?? checkRateLimit(ip, now);
  }
  try {
    const result = await binding.limit({ key: ip });
    if (result.success) {
      const edgeResult = await edgeCacheLimiter(ip, now);
      return edgeResult ?? { allowed: true, remaining: 0, retryAfterSeconds: 0 };
    }
    // binding 側で blocked。Cloudflare Rate Limiting binding は retry-after を
    // 直接返さないため、wrangler.jsonc の simple.period (60s) を上限とした
    // 概算値を使う (sliding window の最大残時間)。
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  } catch (err) {
    // binding 呼び出しが失敗した場合は安全側で in-memory に fallback して
    // サービス継続を優先 (binding alpha / 一時的障害時の影響を抑える)。
    console.error('[rate-limit-binding] limit() failed, falling back to in-memory:', err);
    const edgeResult = await edgeCacheLimiter(ip, now);
    return edgeResult ?? checkRateLimit(ip, now);
  }
}

interface RateLimitCachePayload {
  timestamps: number[];
}

const RATE_LIMIT_CACHE_ORIGIN = 'https://citation-reader-rate-limit.local';

async function checkEdgeCacheRateLimit(ip: string, now: number): Promise<RateLimitResult | null> {
  try {
    const cacheStorage = globalThis.caches as (CacheStorage & { default?: Cache }) | undefined;
    const cache = cacheStorage?.default;
    if (!cache) return null;

    const cacheRequest = new Request(
      `${RATE_LIMIT_CACHE_ORIGIN}/${await hashBucketKey(`rate:${ip}`)}`,
    );
    const cached = await cache.match(cacheRequest);
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = cached
      ? parseRateLimitCachePayload(await cached.text()).filter((t) => t > cutoff)
      : [];

    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      const oldest = timestamps[0] ?? now;
      const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    timestamps.push(now);
    await cache.put(
      cacheRequest,
      new Response(JSON.stringify({ timestamps } satisfies RateLimitCachePayload), {
        headers: {
          'Cache-Control': `max-age=${Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)}`,
          'Content-Type': 'application/json',
        },
      }),
    );

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - timestamps.length,
      retryAfterSeconds: 0,
    };
  } catch {
    return null;
  }
}

function parseRateLimitCachePayload(text: string): number[] {
  try {
    const payload: unknown = JSON.parse(text);
    if (!isRateLimitCachePayload(payload)) return [];
    return payload.timestamps.filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

function isRateLimitCachePayload(value: unknown): value is RateLimitCachePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { timestamps?: unknown }).timestamps) &&
    (value as { timestamps: unknown[] }).timestamps.every((item) => typeof item === 'number')
  );
}

async function hashBucketKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
