// 注意: ESLint の no-unsafe-* は @anthropic-ai/sdk 0.90 の messages.stream / event 型推論で
// 誤検出が出る。ファイル全体での disable は範囲が広すぎるので、SDK 呼び出し / event 反復の
// 関数だけに局所的に disable する。

import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { MODEL } from '@/lib/models';
import { getClientIp } from '@/lib/rate-limit';
import { checkRateLimitFromContext } from '@/lib/rate-limit-binding';
import { checkAccess } from '@/lib/auth';
import { readSessionCookieFromHeader, verifySessionCookieValue } from '@/lib/session';
import { toCitationLocation } from '@/lib/citations';
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
// 回答内の Markdown がそのまま表示されることを避ける:
// UI 側は streaming + 引用バッジ inline 挿入のために plain text レンダリングをしている。
// react-markdown 等を入れると引用 index との同期が複雑化するため、AI 側に
// プレーンテキスト出力を強制してフォーマット衝突を避ける方針を選択。
const SYSTEM_PROMPT = [
  'あなたはドキュメントを正確に読み取って要約・質問応答するアシスタントです。',
  '',
  '【最重要ルール】回答の言語はユーザーの質問の言語と必ず一致させてください。質問が日本語なら必ず日本語で、英語なら英語で回答してください。例外なく守ること。',
  '',
  '【出力フォーマット】回答は必ずプレーンテキストで返してください。Markdown 記法 (** ## - * 等) や箇条書きの記号は使わず、自然な文章で書いてください。改行は段落単位で最低限のみ使い、太字や見出しの装飾は不要です。',
  '',
  'ドキュメントから具体的な記述を引用しながら回答し、推測や憶測は避けてください。ドキュメントに書かれていないことを聞かれた場合は「ドキュメントに記載がありません」と答えてください。',
].join('\n');

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
 * Anthropic messages.stream に渡す params を組み立てる純関数 (SDK 型に依存しない).
 * 内容は次のとおり:
 * - document content block: media_type=text/plain, citations enabled, ephemeral cache
 * - text content block: user の質問 (空欄なら DEFAULT_QUESTION で要約させる)
 */
function buildStreamParams(documentText: string, userQuestion: string) {
  return {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'document' as const,
            source: {
              type: 'text' as const,
              media_type: 'text/plain' as const,
              data: documentText,
            },
            title: 'User Document',
            citations: { enabled: true },
            cache_control: { type: 'ephemeral' as const },
          },
          { type: 'text' as const, text: userQuestion },
        ],
      },
    ],
  };
}

/**
 * SDK の content_block_delta event を SSE 用 ChatStreamEvent に変換して送出する。
 * - text_delta → ChatTextDelta
 * - citations_delta → toCitationLocation で runtime 検証してから ChatCitationDelta
 * 不整合な citation は黙って捨てる (回答テキストは引き続き流れる)。
 */
function emitContentBlockDelta(event: unknown, send: SendEvent): void {
  // 型: { type: 'content_block_delta'; index: number; delta: ... } を想定
  const e = event as { type: string; index: number; delta: { type: string } };
  if (e.type !== 'content_block_delta') return;
  const delta = e.delta;
  const index = e.index;
  if (delta.type === 'text_delta') {
    const textDelta = delta as { type: 'text_delta'; text: string };
    send({ type: 'text', text: textDelta.text, index });
  } else if (delta.type === 'citations_delta') {
    const citationDelta = delta as { type: 'citations_delta'; citation: unknown };
    const citation = toCitationLocation(citationDelta.citation);
    if (citation) {
      send({ type: 'citation', citation, index });
    }
  }
}

/**
 * SDK の finalMessage から usage を取り出して done event を送出する。
 * usage が無い場合 (stream 中断等) は usage プロパティ抜きで送る。
 */
function emitDoneEvent(finalMessage: unknown, send: SendEvent): void {
  const m = finalMessage as {
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number | null;
      cache_read_input_tokens?: number | null;
    };
  };
  send({
    type: 'done',
    usage: m.usage
      ? {
          input_tokens: m.usage.input_tokens,
          output_tokens: m.usage.output_tokens,
          cache_creation_input_tokens: m.usage.cache_creation_input_tokens ?? undefined,
          cache_read_input_tokens: m.usage.cache_read_input_tokens ?? undefined,
        }
      : undefined,
  });
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
  // maxRetries: 0 にして、429/5xx時にSDKが自動リトライして多重課金するのを防ぐ。
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const encoder = new TextEncoder();

  // クライアントがfetchをabortしたらAnthropicのstreamも止める（コスト保護）。
  // 何もしないとSDKのMessageStreamは独立に走り続け、裏で課金が進む可能性がある。
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/await-thenable, @typescript-eslint/no-redundant-type-constituents */
  let anthropicStream: Awaited<ReturnType<typeof client.messages.stream>> | null = null;
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
        anthropicStream = await client.messages.stream(
          buildStreamParams(documentText, userQuestion),
        );
        for await (const event of anthropicStream) {
          emitContentBlockDelta(event, send);
        }
        const finalMessage = await anthropicStream.finalMessage();
        emitDoneEvent(finalMessage, send);
      } catch (err) {
        emitErrorEvent(err, req.signal.aborted, send);
      } finally {
        req.signal.removeEventListener('abort', onClientAbort);
        controller.close();
      }
    },
  });
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/await-thenable, @typescript-eslint/no-redundant-type-constituents */

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
