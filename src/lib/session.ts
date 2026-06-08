/**
 * 短期セッションcookieの発行・検証。
 *
 * 共有秘密Bearerを毎回送る設計から、
 * 認証成功後にHMAC署名済みの短期セッションcookieを発行する設計へ移行する。
 * Bearer経路は段階移行のため互換維持 (cookieが無ければBearer検証にfallback)。
 *
 * セキュリティ要件:
 * - cookieはHMAC-SHA256 で署名 (改竄検出)
 * - TTLは 1 時間 (期限切れチェックは検証側で実施)
 * - secretはCloudflare Workers Secret (ACCESS_PASSWORD) を流用 (32+ bytes想定)
 * - cookie名は `__Host-` prefixでSecure / Path=/ / Domainなし強制
 * - SameSite=StrictでCSRF抑止
 *
 * dev環境制約: `__Host-` prefixはSecure必須なのでlocalhost httpでは設定不可。
 * devではBearer fallbackで動く (cookie検証失敗 → Bearer検証成功 → 通過)。
 */

const COOKIE_NAME = '__Host-cra-session';
const TTL_MS = 60 * 60 * 1000; // 1 時間

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const pad = '==='.slice((s.length + 3) % 4);
    const padded = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const binary = atob(padded);
    // ArrayBuffer由来のUint8Arrayを明示的に作る (TS 5.7+ で
    // crypto.subtle.verifyが `Uint8Array<ArrayBuffer>` を要求するため、
    // SharedArrayBuffer候補を含む `Uint8Array<ArrayBufferLike>` を渡せない)。
    const buf = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * 期限 (UNIX ms) をpayloadとし、HMAC-SHA256 署名を付けたcookie値を返す。
 * 形式: `<expirationMs>.<base64url(signature)>`
 */
export async function issueSessionCookieValue(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const exp = now + TTL_MS;
  const payload = String(exp);
  const enc = new TextEncoder();
  const key = await importHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sig = base64urlEncode(new Uint8Array(sigBuf));
  return `${payload}.${sig}`;
}

/**
 * cookie値のHMAC署名を検証し、期限切れでないことを確認する。
 * payload改竄 / 署名不一致 / 期限切れ / 形式不正のいずれもfalseを返す。
 */
export async function verifySessionCookieValue(
  cookieValue: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!cookieValue) return false;
  const dotIdx = cookieValue.indexOf('.');
  if (dotIdx <= 0 || dotIdx === cookieValue.length - 1) return false;
  const payload = cookieValue.slice(0, dotIdx);
  const sigStr = cookieValue.slice(dotIdx + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const sigBytes = base64urlDecode(sigStr);
  if (!sigBytes) return false;
  const enc = new TextEncoder();
  const key = await importHmacKey(secret);
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
}

/**
 * Set-Cookieヘッダ用文字列を組み立てる。
 * `__Host-` prefixのためDomain指定なし / Path=/ / Secure必須。
 */
export function buildSessionSetCookieHeader(cookieValue: string, ttlMs: number = TTL_MS): string {
  const maxAge = Math.floor(ttlMs / 1000);
  return `${COOKIE_NAME}=${cookieValue}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

/**
 * Cookieヘッダ文字列から現在のセッション用cookie値を取り出す。
 * 該当cookieが無ければnull。
 */
export function readSessionCookieFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq);
    if (name === COOKIE_NAME) return trimmed.slice(eq + 1);
  }
  return null;
}

export const SESSION_COOKIE = {
  NAME: COOKIE_NAME,
  TTL_MS,
};
