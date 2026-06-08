import { describe, expect, it } from 'vitest';
import {
  buildSessionSetCookieHeader,
  issueSessionCookieValue,
  readSessionCookieFromHeader,
  SESSION_COOKIE,
  verifySessionCookieValue,
} from './session';

const SECRET = 'test-secret-for-session-tests-32bytes';

describe('issueSessionCookieValue + verifySessionCookieValue', () => {
  it('発行直後のcookieは同じsecretで検証できる', async () => {
    const now = 1_700_000_000_000;
    const v = await issueSessionCookieValue(SECRET, now);
    expect(await verifySessionCookieValue(v, SECRET, now + 1000)).toBe(true);
  });

  it('期限切れのcookieはfalse (TTL 1h超過)', async () => {
    const now = 1_700_000_000_000;
    const v = await issueSessionCookieValue(SECRET, now);
    const afterTtl = now + SESSION_COOKIE.TTL_MS + 1;
    expect(await verifySessionCookieValue(v, SECRET, afterTtl)).toBe(false);
  });

  it('別のsecretで検証するとfalse (改竄検出)', async () => {
    const now = 1_700_000_000_000;
    const v = await issueSessionCookieValue(SECRET, now);
    expect(await verifySessionCookieValue(v, 'different-secret', now + 1000)).toBe(false);
  });

  it('payloadを書き換えると署名不一致でfalse', async () => {
    const now = 1_700_000_000_000;
    const v = await issueSessionCookieValue(SECRET, now);
    const dotIdx = v.indexOf('.');
    const tampered = `${Number(v.slice(0, dotIdx)) + 86_400_000}.${v.slice(dotIdx + 1)}`;
    expect(await verifySessionCookieValue(tampered, SECRET, now + 1000)).toBe(false);
  });

  it('署名部分を書き換えるとfalse', async () => {
    const now = 1_700_000_000_000;
    const v = await issueSessionCookieValue(SECRET, now);
    const dotIdx = v.indexOf('.');
    // 署名の 1 文字目を別の文字に書き換え
    const sig = v.slice(dotIdx + 1);
    const flipped = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
    const tampered = `${v.slice(0, dotIdx)}.${flipped}`;
    expect(await verifySessionCookieValue(tampered, SECRET, now + 1000)).toBe(false);
  });

  it('空文字 / dot抜き / 形式不正はfalse', async () => {
    expect(await verifySessionCookieValue('', SECRET)).toBe(false);
    expect(await verifySessionCookieValue('no-dot', SECRET)).toBe(false);
    expect(await verifySessionCookieValue('.empty-payload', SECRET)).toBe(false);
    expect(await verifySessionCookieValue('payload-only.', SECRET)).toBe(false);
  });

  it('数値でないpayloadはfalse', async () => {
    expect(await verifySessionCookieValue('abc.signature', SECRET)).toBe(false);
  });
});

describe('buildSessionSetCookieHeader', () => {
  it('Secure / HttpOnly / SameSite=Strict / Path=/ を含む __Host- cookie', () => {
    const header = buildSessionSetCookieHeader('foo.bar', 3600_000);
    expect(header).toContain('__Host-cra-session=foo.bar');
    expect(header).toContain('Secure');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=3600');
  });

  it('TTLを秒単位floorでMax-Ageに反映', () => {
    const header = buildSessionSetCookieHeader('v', 1500);
    expect(header).toContain('Max-Age=1');
  });
});

describe('readSessionCookieFromHeader', () => {
  it('Cookieヘッダから現在のセッション用の値を取り出す', () => {
    const r = readSessionCookieFromHeader(
      'other=foo; __Host-cra-session=expected.signature; another=bar',
    );
    expect(r).toBe('expected.signature');
  });

  it('該当cookieがなければnull', () => {
    expect(readSessionCookieFromHeader('other=foo; another=bar')).toBeNull();
  });

  it('null / 空文字はnull', () => {
    expect(readSessionCookieFromHeader(null)).toBeNull();
    expect(readSessionCookieFromHeader('')).toBeNull();
  });

  it('cookie値に = が含まれていても正しく取り出す (払い出した値の最後にpadding等)', () => {
    const r = readSessionCookieFromHeader('__Host-cra-session=abc.def=padding');
    expect(r).toBe('abc.def=padding');
  });
});
