/**
 * IPごとに60秒窓で数えるメモリ上のrate limiter。
 *
 * この実装を残す理由:
 *   - productionでは`rate-limit-binding.ts`経由でCloudflare Workers Rate Limiting bindingを優先する。
 *   - local dev / Vitestにはbindingがないため、再現しやすいメモリ実装をfallbackにする。
 *
 * このfallbackだけではproduction用として足りない理由:
 *   - Cloudflare Workersは複数isolateで動くことがあり、カウンタはisolateごとに分かれる。
 *   - route境界では`checkRateLimitFromContext()`を使い、productionでCloudflare binding経路を通す。
 *
 * 後でKVなどに差し替えやすいよう、`checkRateLimit`の返り値は現在の形に揃えている。
 */

interface RequestLog {
  timestamps: number[];
}

const buckets = new Map<string, RequestLog>();

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const bucket = buckets.get(ip) ?? { timestamps: [] };

  // 期限切れtimestampを捨てる
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    // noUncheckedIndexedAccess対策: length >= MAX_REQUESTS (>=1) なので [0] は必ず存在
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    buckets.set(ip, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(ip, bucket);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
