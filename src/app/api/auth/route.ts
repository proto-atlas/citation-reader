import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { checkRateLimitFromContext } from '@/lib/rate-limit-binding';
import { buildSessionSetCookieHeader, issueSessionCookieValue } from '@/lib/session';
import type { ApiErrorResponse } from '@/lib/types';

// dev / Vitest / binding 未設定環境では context 取得が失敗 / undefined
// になり得る。in-memory fallback に任せるため、失敗を握りつぶして undefined を返す。
async function getCfEnv(): Promise<unknown> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    return ctx?.env;
  } catch {
    return undefined;
  }
}

/**
 * Lightweight password validation endpoint.
 * Used by the PasswordGate to verify the password before unlocking the main UI,
 * so users don't briefly see the app with an invalid password.
 *
 * Does not call Anthropic, does not consume any tokens.
 *
 * Rate limit: aggressive total-request throttling on /api/auth keyed by IP.
 * Cause: 認証エンドポイントの総当たり耐性を補強する。
 * 共有秘密の総当たり耐性として OWASP Authentication Cheat Sheet 推奨に従う。
 * 一般的な login throttling と異なり「失敗だけカウント」しない (アクセスキー判定の前に
 * rate-limit を回すことでタイミング攻撃の窓も狭める)。
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ip = getClientIp(req);
  // Cloudflare Rate Limiting binding が利用可能なら全 isolate 跨ぎで判定。
  // binding 不在 (dev / Vitest) なら lib/rate-limit-binding.ts が in-memory fallback。
  const env = await getCfEnv();
  const rate = await checkRateLimitFromContext(env, ip);
  if (!rate.allowed) {
    const body: ApiErrorResponse = {
      error: 'rate_limit',
      retryAfterSeconds: rate.retryAfterSeconds,
    };
    return Response.json(body, {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds) },
    });
  }

  const expectedPassword = process.env.ACCESS_PASSWORD;
  if (!checkAccess(req.headers.get('Authorization'), expectedPassword)) {
    const body: ApiErrorResponse = { error: 'unauthorized' };
    return Response.json(body, { status: 401 });
  }

  // 認証成功後、HMAC 署名済み短期セッション cookie を発行する。
  // secret は ACCESS_PASSWORD を流用 (32+ bytes 想定)。dev 環境では `__Host-`
  // prefix の Secure 要件で http localhost に cookie が乗らないが、/api/chat
  // 側は cookie 不在時に Authorization Bearer へ fallback する設計のため UX に
  // 影響しない。
  const sessionValue = await issueSessionCookieValue(expectedPassword as string);
  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: { 'Set-Cookie': buildSessionSetCookieHeader(sessionValue) },
    },
  );
}
