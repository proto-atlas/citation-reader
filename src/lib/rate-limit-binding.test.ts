import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimitFromContext } from './rate-limit-binding';

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');

class MemoryCache {
  private readonly store = new Map<string, Response>();

  match(request: RequestInfo | URL): Promise<Response | undefined> {
    return Promise.resolve(this.store.get(new Request(request).url)?.clone());
  }

  put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.store.set(new Request(request).url, response.clone());
    return Promise.resolve();
  }
}

function installMemoryCache(cache: MemoryCache): void {
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { default: cache as unknown as Cache },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalCachesDescriptor) {
    Object.defineProperty(globalThis, 'caches', originalCachesDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, 'caches');
});

describe('checkRateLimitFromContext', () => {
  it('envがundefinedならin-memory fallback (binding未設定環境)', async () => {
    const result = await checkRateLimitFromContext(undefined, '192.0.2.10');
    expect(result.allowed).toBe(true);
    expect(typeof result.retryAfterSeconds).toBe('number');
  });

  it('envがnon-objectならin-memory fallback', async () => {
    const result = await checkRateLimitFromContext('not-object', '192.0.2.11');
    expect(result.allowed).toBe(true);
  });

  it('RATE_LIMITERが存在しなければin-memory fallback', async () => {
    const result = await checkRateLimitFromContext({ OTHER_BINDING: {} }, '192.0.2.12');
    expect(result.allowed).toBe(true);
  });

  it('RATE_LIMITER.limitが関数でなければfallback', async () => {
    const result = await checkRateLimitFromContext(
      { RATE_LIMITER: { limit: 'not-a-function' } },
      '192.0.2.13',
    );
    expect(result.allowed).toBe(true);
  });

  it('bindingがsuccess: trueを返したらallowed: true', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const result = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.14');
    expect(result.allowed).toBe(true);
    expect(limit).toHaveBeenCalledWith({ key: '192.0.2.14' });
  });

  it('bindingがsuccess: trueでもedge cacheが同一edge内のburstを止める', async () => {
    installMemoryCache(new MemoryCache());
    const limit = vi.fn().mockResolvedValue({ success: true });
    let last;

    for (let i = 0; i < 10; i++) {
      last = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.17', 1000 + i);
    }

    expect(last?.allowed).toBe(true);
    expect(last?.remaining).toBe(0);

    const blocked = await checkRateLimitFromContext(
      { RATE_LIMITER: { limit } },
      '192.0.2.17',
      1010,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('bindingがsuccess: falseを返したらallowed: false + retryAfterSeconds=60', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const result = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.15');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it('bindingがthrowしたらin-memory fallback (alpha障害時のサービス継続)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const limit = vi.fn().mockRejectedValue(new Error('binding alpha unavailable'));
    const result = await checkRateLimitFromContext({ RATE_LIMITER: { limit } }, '192.0.2.16');
    expect(result.allowed).toBe(true);
    expect(limit).toHaveBeenCalled();
  });
});
