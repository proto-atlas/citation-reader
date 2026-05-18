/**
 * Simple shared-secret access gate.
 *
 * The password is stored in:
 *   - .env.local locally (ACCESS_PASSWORD=xxx) — Next.js dev server が読む env file
 *   - Cloudflare Workers Secret in production (`wrangler secret put ACCESS_PASSWORD`)
 *
 * Client sends it as the `Authorization: Bearer <password>` header.
 * The server compares with constant-time equality.
 *
 * This is intentionally minimal — it's enough to prevent random
 * scrapers from burning the Anthropic budget while still letting
 * the recipient of the demo URL try it without signup friction.
 *
 * 注意: `/api/auth` `/api/chat` の両方で IP レート制限を併用しているため、
 * 共有秘密の総当たり耐性は現実的にこの 2 段で担保している。
 */

export const STORAGE_KEY = 'citation-reader.access';

export function checkAccess(authHeader: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const provided = m[1]?.trim();
  if (!provided) return false;
  return constantTimeEqual(provided, expected);
}

/**
 * 簡易的な定時間比較。
 * 長さが違う場合も早期 return せず、最長長まで比較してから長さ差分を反映する。
 * Node.js crypto.timingSafeEqual を直接使うと Edge runtime / Workers 互換性の説明が増えるため、
 * ここでは短い共有秘密向けに依存なしの実装へ寄せている。
 */
function constantTimeEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i++) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= aCode ^ bCode;
  }
  return mismatch === 0;
}
