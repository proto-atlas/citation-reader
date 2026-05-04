import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { MODEL } from '@/lib/models';
import { getClientIp } from '@/lib/rate-limit';
import { checkRateLimitFromContext } from '@/lib/rate-limit-binding';
import { checkAccess } from '@/lib/auth';
import { readSessionCookieFromHeader, verifySessionCookieValue } from '@/lib/session';
import {
  createAnthropicCitationStreamClient,
  toChatStreamEvents,
  toDoneUsage,
  type CitationMessageStream,
} from '@/lib/anthropic-citation-stream';
import type { ApiErrorResponse, ChatErrorCode, ChatRequest, ChatStreamEvent } from '@/lib/types';

// binding 不在 / context 取得失敗時は wrapper の in-memory fallback に流す
async function getCfEnv(): Promise<unknown> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    return ctx?.env;
  } catch {
    return undefined;
  }
}

const MAX_DOCUMENT_LENGTH = 200_000;
const MAX_QUESTION_LENGTH = 1_000;
const DEFAULT_QUESTION =
  'このドキュメントの主要な論点を日本語 300 文字以内で簡潔に要約してください。各主要な主張には必ず引用元を示し、ドキュメント内の具体的な記述を引用してください。';
// SSE event を SSE プロトコル形式 (`data: ...\n\n`) で controller に送る関数の型。
// emit* ヘルパー群がこの型を引数に取る (controller / encoder の詳細を隠す)。
type SendEvent = (event: ChatStreamEvent) => void;

/**
 * 非 streaming エラー (認証・rate-limit・validation) を ApiErrorResponse 形式で返す。
 * 内部詳細を漏らさず code のみを返却し、UI 側で日本語に変換 (ERROR_LABELS) する。
 */
function jsonError(code: ChatErrorCode, status: number, retryAfterSeconds?: number): Response {
  const body: ApiErrorResponse = retryAfterSeconds
    ? { error: code, retryAfterSeconds }
    : { error: code };
  const headers: Record<string, string> = {};
  if (retryAfterSeconds) headers['Retry-After'] = String(retryAfterSeconds);
  return Response.json(body, { status, headers });
}

/**
 * リクエストボディ shape を runtime validation して ChatRequest に絞り込む。
 * body shape を runtime validation する:
 * 型キャスト (as ChatRequest) のみだと文字列以外や追加属性が入っても通ってしまう。
 *
 * 戻り値:
 * - 正常: ChatRequest オブジェクト
 * - 異常: エラーコード文字列 ('invalid_input' / 'document_too_long' / 'question_too_long')
 */
type ParseChatRequestResult =
  | { ok: true; value: ChatRequest }
  | { ok: false; code: 'invalid_input' | 'document_too_long' | 'question_too_long' };

export function parseChatRequest(
  input: unknown,
  max: { doc: number; q: number },
): ParseChatRequestResult {
  if (!input || typeof input !== 'object') return { ok: false, code: 'invalid_input' };
  const obj = input as Record<string, unknown>;
  const documentText = typeof obj.documentText === 'string' ? obj.documentText.trim() : '';
  if (!documentText) return { ok: false, code: 'invalid_input' };
  if (documentText.length > max.doc) return { ok: false, code: 'document_too_long' };

  // question は省略可能、文字列でなければ空扱い
  const rawQuestion = typeof obj.question === 'string' ? obj.question.trim() : '';
  if (rawQuestion.length > max.q) return { ok: false, code: 'question_too_long' };

  return {
    ok: true,
    value: rawQuestion ? { documentText, question: rawQuestion } : { documentText },
  };
}

/**
 * SSE 上の error event を送出する。raw err.message は UI に出さず、
 * 内部詳細は console.error にだけ残す (OWASP Improper Error Handling 対応)。
 * abort 由来の例外はユーザーには通知しない (キャンセルは正常フロー)。
 */
function emitErrorEvent(err: unknown, signalAborted: boolean, send: SendEvent): void {
  if (signalAborted) return;
  console.error('chat: anthropic stream failed', err instanceof Error ? err.message : err);
  send({ type: 'error', code: 'upstream_unavailable' });
}

export async function POST(req: NextRequest): Promise<Response> {
  const expectedPassword = process.env.ACCESS_PASSWORD;
  // 認証は session cookie 優先、不在 / 失効 / 改竄なら Bearer に fallback。
  // session cookie は /api/auth が認証成功時に発行する HMAC 署名 + TTL 1h の短期 token。
  // Bearer 互換は段階移行のため維持 (E2E や既存 client が Bearer 経路で通る)。
  const sessionCookie = readSessionCookieFromHeader(req.headers.get('Cookie'));
  let authorized = false;
  if (sessionCookie && expectedPassword) {
    authorized = await verifySessionCookieValue(sessionCookie, expectedPassword);
  }
  if (!authorized && !checkAccess(req.headers.get('Authorization'), expectedPassword)) {
    return jsonError('unauthorized', 401);
  }

  const ip = getClientIp(req);
  // Cloudflare Rate Limiting binding 経由で全 isolate 跨ぎ判定。
  // dev / Vitest / binding 未設定なら wrapper が in-memory fallback。
  const env = await getCfEnv();
  const rate = await checkRateLimitFromContext(env, ip);
  if (!rate.allowed) {
    return jsonError('rate_limit', 429, rate.retryAfterSeconds);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError('invalid_input', 400);
  }

  const parsed = parseChatRequest(raw, { doc: MAX_DOCUMENT_LENGTH, q: MAX_QUESTION_LENGTH });
  if (!parsed.ok) {
    return jsonError(parsed.code, 400);
  }
  const { documentText, question = '' } = parsed.value;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // 内部設定不足は本番で出すと採用評価担当者を不安にさせるが、ログには残す
    console.error('chat: ANTHROPIC_API_KEY not set in environment');
    return jsonError('server_misconfigured', 500);
  }

  const userQuestion = question || DEFAULT_QUESTION;
  const client = createAnthropicCitationStreamClient(apiKey);

  const encoder = new TextEncoder();

  // クライアントがfetchをabortしたらAnthropicのstreamも止める（コスト保護）。
  // 何もしないとSDKのMessageStreamは独立に走り続け、裏で課金が進む可能性がある。
  let anthropicStream: CitationMessageStream | null = null;
  const onClientAbort = () => {
    anthropicStream?.abort();
  };
  req.signal.addEventListener('abort', onClientAbort);

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SendEvent = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        send({ type: 'meta', model: MODEL });
        anthropicStream = client.createStream(documentText, userQuestion);
        for await (const event of anthropicStream) {
          for (const chatEvent of toChatStreamEvents(event)) {
            send(chatEvent);
          }
        }
        const finalMessage = await anthropicStream.finalMessage();
        send({ type: 'done', usage: toDoneUsage(finalMessage) });
      } catch (err) {
        emitErrorEvent(err, req.signal.aborted, send);
      } finally {
        req.signal.removeEventListener('abort', onClientAbort);
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
