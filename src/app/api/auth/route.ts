import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAccess } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { checkRateLimitFromContext } from '@/lib/rate-limit-binding';
import { buildSessionSetCookieHeader, issueSessionCookieValue } from '@/lib/session';
import type { ApiErrorResponse } from '@/lib/types';

// dev / Vitest / binding未設定環境ではcontext取得が失敗 / undefined
// になり得る。in-memory fallbackに任せるため、失敗を握りつぶしてundefinedを返す。
async function getCfEnv(): Promise<unknown> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    return ctx?.env;
  } catch {
    return undefined;
  }
}

/**
 * 画面表示前にアクセスキーを確認する軽量エンドポイント。
 * 無効なアクセスキーで一瞬だけメイン画面が見える状態を避ける。
 *
 * Anthropicは呼ばず、トークンも消費しない。
 *
 * Rate limit: IP単位で /api/authの総リクエスト数を強めに制限する。
 * Cause: 認証エンドポイントの総当たり耐性を補強する。
 * 共有秘密の総当たり耐性としてOWASP Authentication Cheat Sheet推奨に従う。
 * 一般的なlogin throttlingと異なり「失敗だけカウント」しない (アクセスキー判定の前に
 * rate-limitを回すことでタイミング攻撃の窓も狭める)。
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ip = getClientIp(req);
  // Cloudflare Rate Limiting bindingが利用可能なら全isolate跨ぎで判定。
  // binding不在 (dev / Vitest) ならlib/rate-limit-binding.tsがin-memory fallback。
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

  // 認証成功後、HMAC署名済み短期セッションcookieを発行する。
  // secretはACCESS_PASSWORDを流用 (32+ bytes想定)。dev環境では `__Host-`
  // prefixのSecure要件でhttp localhostにcookieが乗らないが、/api/chat
  // 側はcookie不在時にAuthorization Bearerへfallbackする設計のためUXに
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
