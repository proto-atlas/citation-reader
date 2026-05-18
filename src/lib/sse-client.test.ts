import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamChat, type StreamHandlers } from './sse-client';

/** SSE レスポンス body を ReadableStream で組み立てるヘルパー。 */
function sseResponse(chunks: readonly string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status });
}

interface RecordedHandlers {
  meta: unknown[];
  text: unknown[];
  citation: unknown[];
  error: unknown[];
  done: unknown[];
  unauthorized: number;
}

function recordHandlers(): { handlers: StreamHandlers; recorded: RecordedHandlers } {
  const recorded: RecordedHandlers = {
    meta: [],
    text: [],
    citation: [],
    error: [],
    done: [],
    unauthorized: 0,
  };
  const handlers: StreamHandlers = {
    onMeta: (e) => recorded.meta.push(e),
    onText: (e) => recorded.text.push(e),
    onCitation: (e) => recorded.citation.push(e),
    onError: (e) => recorded.error.push(e),
    onDone: (e) => recorded.done.push(e),
    onUnauthorized: () => {
      recorded.unauthorized += 1;
    },
  };
  return { handlers, recorded };
}

/** fetch を stub して固定レスポンスを返すヘルパー（async 不要のため同期関数で Promise を返す）。 */
function stubFetchWith(response: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  );
}

describe('streamChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('text イベントを onText で受け取る', async () => {
    stubFetchWith(sseResponse(['data: {"type":"text","index":0,"text":"こんにちは"}\n\n']));
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.text[0]).toMatchObject({ type: 'text', index: 0, text: 'こんにちは' });
  });

  it('複数イベントがひとつのチャンクにまとまっていても \\n\\n で分割される', async () => {
    stubFetchWith(
      sseResponse([
        'data: {"type":"meta","model":"claude-haiku-4-5"}\n\n' +
          'data: {"type":"text","index":0,"text":"a"}\n\n' +
          'data: {"type":"done"}\n\n',
      ]),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.meta).toHaveLength(1);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.done).toHaveLength(1);
  });

  it('[DONE] 混入行は無視する', async () => {
    stubFetchWith(
      sseResponse([
        'data: {"type":"text","index":0,"text":"a"}\n\n',
        'data: [DONE]\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.done).toHaveLength(1);
    expect(recorded.error).toHaveLength(0);
  });

  it('不正JSON行はスキップして後続の正しい行は処理する', async () => {
    stubFetchWith(
      sseResponse(['data: {broken json\n\n', 'data: {"type":"text","index":0,"text":"ok"}\n\n']),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.error).toHaveLength(0);
  });

  it('チャンク境界が \\n\\n を跨いでも再構築できる', async () => {
    stubFetchWith(
      sseResponse([
        'data: {"type":"text","index":0,"text":"hello',
        '"}\n\ndata: {"type":"done"}\n\n',
      ]),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.text[0]).toMatchObject({ text: 'hello' });
    expect(recorded.done).toHaveLength(1);
  });

  it('ステータス401なら onUnauthorized と onError を呼ぶ', async () => {
    stubFetchWith(new Response('Unauthorized', { status: 401 }));
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.unauthorized).toBe(1);
    expect(recorded.error).toHaveLength(1);
  });

  it('ステータス500でJSONの error code を onError に伝える', async () => {
    stubFetchWith(
      new Response(JSON.stringify({ error: 'server_misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.error).toHaveLength(1);
    expect(recorded.error[0]).toMatchObject({ type: 'error', code: 'server_misconfigured' });
  });

  it('ステータス429で rate_limit code を onError に伝える', async () => {
    stubFetchWith(
      new Response(JSON.stringify({ error: 'rate_limit', retryAfterSeconds: 30 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      }),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.error[0]).toMatchObject({ type: 'error', code: 'rate_limit' });
  });

  it('JSON が解釈不能なエラー応答は unknown code にフォールバックする', async () => {
    stubFetchWith(new Response('not json', { status: 502 }));
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.error[0]).toMatchObject({ type: 'error', code: 'unknown' });
  });

  it('終端 \\n\\n が無くても閉じ際のバッファは捨てる (壊れた最終フレームを処理しない)', async () => {
    // ストリームの最後に \n\n が無いケース。サーバが close した時点で残った buffer は
    // 不完全なため、解釈せず捨てる挙動を確認する (実装は parts.pop() で残りを保持し、
    // ループを抜けた後は使わない)。
    stubFetchWith(
      sseResponse([
        'data: {"type":"text","index":0,"text":"complete"}\n\n',
        // 終端 \n\n なし、これは捨てられる想定
        'data: {"type":"text","index":1,"text":"truncat',
      ]),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.text[0]).toMatchObject({ text: 'complete' });
    expect(recorded.error).toHaveLength(0);
  });

  it('巨大ペイロード (10K 行) を順序保持で処理できる', async () => {
    // 境界値テスト: SSE フレームが多くても dispatch が崩れないことを確認。
    const lines = Array.from(
      { length: 10_000 },
      (_, i) => `data: {"type":"text","index":${i},"text":"line${i}"}\n\n`,
    );
    stubFetchWith(sseResponse([lines.join('') + 'data: {"type":"done"}\n\n']));
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(10_000);
    expect(recorded.text[0]).toMatchObject({ text: 'line0' });
    expect(recorded.text[9_999]).toMatchObject({ text: 'line9999' });
    expect(recorded.done).toHaveLength(1);
  });

  it('空の data: 行は捨てる', async () => {
    stubFetchWith(
      sseResponse([
        'data: \n\n',
        'data:    \n\n',
        'data: {"type":"text","index":0,"text":"after"}\n\n',
      ]),
    );
    const { handlers, recorded } = recordHandlers();
    await streamChat({ documentText: 'x' }, 'pw', handlers);
    expect(recorded.text).toHaveLength(1);
    expect(recorded.error).toHaveLength(0);
  });
});
