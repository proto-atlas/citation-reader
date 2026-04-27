/**
 * In-memory sliding window rate limiter, keyed by IP.
 *
 * Why in-memory:
 *   - Demo / portfolio scale traffic. Most requests will hit the same isolate.
 *   - Avoids requiring a KV namespace or Durable Object setup before deploy.
 *
 * Why this is NOT enough for production:
 *   - Cloudflare Workers can spin up multiple isolates; counters are per-isolate.
 *   - For real production, swap with Workers KV, Durable Objects, or the
 *     built-in Rate Limiting binding (env.RATE_LIMITER.limit({ key })).
 *
 * The shape of `checkRateLimit` is intentionally similar to a KV-backed
 * implementation so swapping later is mechanical.
 */

interface RequestLog {
  timestamps: number[];
}

const buckets = new Map<string, RequestLog>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - WINDOW_MS;
  const bucket = buckets.get(ip) ?? { timestamps: [] };

  // Drop expired timestamps
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    // noUncheckedIndexedAccess 対策: length >= MAX_REQUESTS (>=1) なので [0] は必ず存在
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = WINDOW_MS - (now - oldest);
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
    remaining: MAX_REQUESTS - bucket.timestamps.length,
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
