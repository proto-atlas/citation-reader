import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsBase,
  MessageStreamEvent,
  Usage,
} from '@anthropic-ai/sdk/resources/messages';
import { MODEL } from '@/lib/models';
import { toCitationLocation } from '@/lib/citations';
import type { ChatDoneDelta, ChatStreamEvent } from '@/lib/types';

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

export interface CitationMessageStream extends AsyncIterable<MessageStreamEvent> {
  abort(): void;
  finalMessage(): Promise<CitationStreamFinalMessage>;
}

export interface CitationStreamClient {
  createStream(documentText: string, userQuestion: string): CitationMessageStream;
}

interface CitationStreamFinalMessage {
  usage?: Usage;
}

export function createAnthropicCitationStreamClient(apiKey: string): CitationStreamClient {
  const client = new Anthropic({
    apiKey,
    // 429/5xx時にSDKが自動リトライして多重課金するのを防ぐ。
    maxRetries: 0,
  });

  return {
    createStream(documentText, userQuestion) {
      return client.messages.stream(buildCitationStreamParams(documentText, userQuestion));
    },
  };
}

export function buildCitationStreamParams(
  documentText: string,
  userQuestion: string,
): MessageCreateParamsBase {
  return {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: documentText,
            },
            title: 'User Document',
            citations: { enabled: true },
            cache_control: { type: 'ephemeral' },
          },
          { type: 'text', text: userQuestion },
        ],
      },
    ],
  };
}

export function toChatStreamEvents(event: MessageStreamEvent): ChatStreamEvent[] {
  if (event.type !== 'content_block_delta') return [];

  const { delta, index } = event;
  if (delta.type === 'text_delta') {
    return [{ type: 'text', text: delta.text, index }];
  }

  if (delta.type === 'citations_delta') {
    const citation = toCitationLocation(delta.citation);
    return citation ? [{ type: 'citation', citation, index }] : [];
  }

  return [];
}

export function toDoneUsage(finalMessage: CitationStreamFinalMessage): ChatDoneDelta['usage'] {
  const { usage } = finalMessage;
  if (!usage) return undefined;
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? undefined,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? undefined,
  };
}
