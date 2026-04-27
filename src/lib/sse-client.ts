import type { ApiErrorResponse, ChatErrorCode, ChatRequest, ChatStreamEvent } from './types';

export interface StreamHandlers {
  onMeta?: (event: Extract<ChatStreamEvent, { type: 'meta' }>) => void;
  onText?: (event: Extract<ChatStreamEvent, { type: 'text' }>) => void;
  onCitation?: (event: Extract<ChatStreamEvent, { type: 'citation' }>) => void;
  onError?: (event: Extract<ChatStreamEvent, { type: 'error' }>) => void;
  onDone?: (event: Extract<ChatStreamEvent, { type: 'done' }>) => void;
  onUnauthorized?: () => void;
}

export async function streamChat(
  body: ChatRequest,
  password: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${password}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 401) {
    handlers.onUnauthorized?.();
    handlers.onError?.({ type: 'error', code: 'unauthorized' });
    return;
  }

  if (!response.ok) {
    // サーバから ApiErrorResponse の `{ error: code, retryAfterSeconds? }` 形式が返る前提。
    // 取り出せない / コードが未定義の場合は 'unknown' にフォールバック。
    let code: ChatErrorCode = 'unknown';
    try {
      const data = (await response.json()) as ApiErrorResponse;
      if (data.error) code = data.error;
    } catch {
      /* malformed, keep 'unknown' */
    }
    handlers.onError?.({ type: 'error', code });
    return;
  }

  if (!response.body) {
    handlers.onError?.({ type: 'error', code: 'unknown' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event = JSON.parse(data) as ChatStreamEvent;
          dispatch(event, handlers);
        } catch {
          /* malformed event, skip */
        }
      }
    }
  }
}

function dispatch(event: ChatStreamEvent, handlers: StreamHandlers): void {
  switch (event.type) {
    case 'meta':
      handlers.onMeta?.(event);
      break;
    case 'text':
      handlers.onText?.(event);
      break;
    case 'citation':
      handlers.onCitation?.(event);
      break;
    case 'error':
      handlers.onError?.(event);
      break;
    case 'done':
      handlers.onDone?.(event);
      break;
    default: {
      // exhaustive check: 将来 ChatStreamEvent に新しい type を足したら
      // ここで TypeScript エラーになって気付ける。
      const _exhaustive: never = event;
      void _exhaustive;
      break;
    }
  }
}
