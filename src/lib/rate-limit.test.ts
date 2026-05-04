import { describe, expect, it } from 'vitest';
import { checkRateLimit, getClientIp } from './rate-limit';

describe('checkRateLimit', () => {
  // 各テストで異なる IP を使い、module-level の buckets が干渉しないようにする。

  it('初回リクエストは許可され、remainingが9になる', () => {
    const result = checkRateLimit('10.0.0.1', 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('10回目のリクエストまでは許可される', () => {
    const ip = '10.0.0.2';
    let last;
    for (let i = 0; i < 10; i++) {
      last = checkRateLimit(ip, 1000 + i);
    }
    expect(last?.allowed).toBe(true);
    expect(last?.remaining).toBe(0);
  });

  it('11回目のリクエストはブロックされる', () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000 + i);
    }
    const blocked = checkRateLimit(ip, 1000 + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('ブロック時のretryAfterSecondsはウィンドウ内の最古タイムスタンプ基準で算出される', () => {
    const ip = '10.0.0.4';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000);
    }
    const blocked = checkRateLimit(ip, 1000 + 30_000);
    // 1000 からウィンドウ 60_000 なので、31_000 の時点で残り 30s
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  it('60秒経過後は古いタイムスタンプが期限切れで、再度許可される', () => {
    const ip = '10.0.0.5';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000);
    }
    const afterWindow = checkRateLimit(ip, 1000 + 60_001);
    expect(afterWindow.allowed).toBe(true);
  });

  it('retryAfterSecondsは最低でも1を返す（切り上げ保証）', () => {
    const ip = '10.0.0.6';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000);
    }
    // ウィンドウ終了直前 1ms 前
    const blocked = checkRateLimit(ip, 1000 + 59_999);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe('getClientIp', () => {
  it('CF-Connecting-IP ヘッダを優先する', () => {
    const req = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '203.0.113.1',
        'x-forwarded-for': '203.0.113.99',
      },
    });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('CF-Connecting-IP がなければ x-forwarded-for の先頭を使う', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.2, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('203.0.113.2');
  });

  it('ヘッダがなければ "unknown" を返す', () => {
    const req = new Request('https://example.com');
    expect(getClientIp(req)).toBe('unknown');
  });
});
