import { describe, expect, it, vi } from 'vitest';
import { checkRateLimitFromContext } from './rate-limit-binding';

describe('checkRateLimitFromContext', () => {
  it('env が undefined なら in-memory fallback (binding 未設定環境)', async () => {
    const result = await checkRateLimitFromContext(undefined, '192.0.2.10');
    expect(result.allowed).toBe(true);
    expect(typeof result.retryAfterSeconds).toBe('number');
  });

  it('env が non-object なら in-memory fallback', async () => {
    const result = await checkRateLimitFromContext('not-object', '192.0.2.11');
    expect(result.allowed).toBe(true);
  });

  it('RATE_LIMITER が存在しなければ in-memory fallback', async () => {
    const result = await checkRateLimitFromContext({ OTHER_BINDING: {} }, '192.0.2.12');
    expect(result.allowed).toBe(true);
  });

  it('RATE_LIMITER.limit が関数でなければ fallback', async () => {
    const result = await checkRateLimitFromContext(
      { RATE_LIMITER: { limit: 'not-a-function' } },
      '192.0.2.13',
    );
    expect(result.allowed).toBe(true);
  });

  it('binding が success: true を返したら allowed: true', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const result = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.14');
    expect(result.allowed).toBe(true);
    expect(limit).toHaveBeenCalledWith({ key: '192.0.2.14' });
  });

  it('binding が success: false を返したら allowed: false + retryAfterSeconds=60', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const result = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.15');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it('binding が throw したら in-memory fallback (alpha 障害時のサービス継続)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const limit = vi.fn().mockRejectedValue(new Error('binding alpha unavailable'));
    const result = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.16');
    expect(result.allowed).toBe(true);
    expect(limit).toHaveBeenCalled();
  });
});
