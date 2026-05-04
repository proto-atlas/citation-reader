/**
 * In-memory sliding window rate limiter, keyed by IP.
 *
 * Why this file still exists:
 *   - Production first uses Cloudflare Workers Rate Limiting binding via
 *     `rate-limit-binding.ts`.
 *   - Local dev / Vitest do not have the binding, so this deterministic
 *     in-memory implementation is the fallback.
 *
 * Why this fallback is NOT enough for production by itself:
 *   - Cloudflare Workers can spin up multiple isolates; counters are per-isolate.
 *   - Keep using `checkRateLimitFromContext()` at route boundaries so production
 *     receives the Cloudflare binding path.
 *
 * The shape of `checkRateLimit` is intentionally similar to a KV-backed
 * implementation so swapping later is mechanical.
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

  // Drop expired timestamps
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    // noUncheckedIndexedAccess 対策: length >= MAX_REQUESTS (>=1) なので [0] は必ず存在
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
