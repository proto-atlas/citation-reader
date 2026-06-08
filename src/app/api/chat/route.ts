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

// binding不在 / context取得失敗時はwrapperのin-memory fallbackに流す
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
// SSE eventをSSEプロトコル形式 (`data: ...\n\n`) でcontrollerに送る関数の型。
// emit* ヘルパー群がこの型を引数に取る (controller / encoderの詳細を隠す)。
type SendEvent = (event: ChatStreamEvent) => void;

/**
 * 非streamingエラー (認証・rate-limit・validation) をApiErrorResponse形式で返す。
 * 内部詳細を漏らさずcodeのみを返却し、UI側で日本語に変換 (ERROR_LABELS) する。
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
 * リクエストボディshapeをruntime validationしてChatRequestに絞り込む。
 * body shapeをruntime validationする:
 * 型キャスト (as ChatRequest) のみだと文字列以外や追加属性が入っても通ってしまう。
 *
 * 戻り値:
 * - 正常: ChatRequestオブジェクト
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

  // questionは省略可能、文字列でなければ空扱い
  const rawQuestion = typeof obj.question === 'string' ? obj.question.trim() : '';
  if (rawQuestion.length > max.q) return { ok: false, code: 'question_too_long' };

  return {
    ok: true,
    value: rawQuestion ? { documentText, question: rawQuestion } : { documentText },
  };
}

/**
 * SSE上のerror eventを送出する。raw err.messageはUIに出さず、
 * 内部詳細はconsole.errorにだけ残す (OWASP Improper Error Handling対応)。
 * abort由来の例外はユーザーには通知しない (キャンセルは正常フロー)。
 */
function emitErrorEvent(err: unknown, signalAborted: boolean, send: SendEvent): void {
  if (signalAborted) return;
  console.error('chat: anthropic stream failed', err instanceof Error ? err.message : err);
  send({ type: 'error', code: 'upstream_unavailable' });
}

export async function POST(req: NextRequest): Promise<Response> {
  const expectedPassword = process.env.ACCESS_PASSWORD;
  // 認証はsession cookie優先、不在 / 失効 / 改竄ならBearerにfallback。
  // session cookieは /api/authが認証成功時に発行するHMAC署名 + TTL 1hの短期token。
  // Bearer互換は段階移行のため維持 (E2Eや既存clientがBearer経路で通る)。
  const sessionCookie = readSessionCookieFromHeader(req.headers.get('Cookie'));
  let authorized = false;
  if (sessionCookie && expectedPassword) {
    authorized = await verifySessionCookieValue(sessionCookie, expectedPassword);
  }
  if (!authorized && !checkAccess(req.headers.get('Authorization'), expectedPassword)) {
    return jsonError('unauthorized', 401);
  }

  const ip = getClientIp(req);
  // Cloudflare Rate Limiting binding経由で全isolate跨ぎ判定。
  // dev / Vitest / binding未設定ならwrapperがin-memory fallback。
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
    // 内部設定不足はログにだけ残し、UIには汎用エラーを返す。
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
