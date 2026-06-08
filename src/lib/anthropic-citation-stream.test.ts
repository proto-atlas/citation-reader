import type { MessageStreamEvent, Usage } from '@anthropic-ai/sdk/resources/messages';
import { describe, expect, test } from 'vitest';
import { MODEL } from './models';
import {
  buildCitationStreamParams,
  toChatStreamEvents,
  toDoneUsage,
} from './anthropic-citation-stream';

describe('buildCitationStreamParams', () => {
  test('文書と質問をAnthropic citations有効のdocument blockに変換する', () => {
    const params = buildCitationStreamParams('根拠文を含む本文', '要約して');

    expect(params.model).toBe(MODEL);
    expect(params.max_tokens).toBe(1024);
    expect(params.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: '根拠文を含む本文',
            },
            title: 'User Document',
            citations: { enabled: true },
            cache_control: { type: 'ephemeral' },
          },
          { type: 'text', text: '要約して' },
        ],
      },
    ]);
  });
});

describe('toChatStreamEvents', () => {
  test('text_deltaをUI用text eventに変換する', () => {
    const event: MessageStreamEvent = {
      type: 'content_block_delta',
      index: 2,
      delta: { type: 'text_delta', text: '回答本文' },
    };

    expect(toChatStreamEvents(event)).toEqual([{ type: 'text', text: '回答本文', index: 2 }]);
  });

  test('citations_deltaをUI用citation eventに変換する', () => {
    const event: MessageStreamEvent = {
      type: 'content_block_delta',
      index: 1,
      delta: {
        type: 'citations_delta',
        citation: {
          type: 'char_location',
          cited_text: '根拠文',
          document_index: 0,
          start_char_index: 0,
          end_char_index: 3,
          document_title: null,
          file_id: null,
        },
      },
    };

    expect(toChatStreamEvents(event)).toEqual([
      {
        type: 'citation',
        index: 1,
        citation: {
          type: 'char_location',
          cited_text: '根拠文',
          document_index: 0,
          document_title: null,
          start_char_index: 0,
          end_char_index: 3,
          start_page_number: undefined,
          end_page_number: undefined,
          start_block_index: undefined,
          end_block_index: undefined,
        },
      },
    ]);
  });

  test('content_block_delta以外は空配列を返す', () => {
    const event: MessageStreamEvent = {
      type: 'message_stop',
    };

    expect(toChatStreamEvents(event)).toEqual([]);
  });

  test('textとcitation以外のdeltaは空配列を返す', () => {
    const event: MessageStreamEvent = {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'thinking_delta', thinking: '内部思考' },
    };

    expect(toChatStreamEvents(event)).toEqual([]);
  });
});

describe('toDoneUsage', () => {
  test('usageがある場合はUI用done usageに変換する', () => {
    const usage: Usage = {
      cache_creation: null,
      cache_creation_input_tokens: 11,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 123,
      output_tokens: 45,
      server_tool_use: null,
      service_tier: 'standard',
    };

    expect(toDoneUsage({ usage })).toEqual({
      input_tokens: 123,
      output_tokens: 45,
      cache_creation_input_tokens: 11,
      cache_read_input_tokens: undefined,
    });
  });

  test('usageがない場合はundefinedを返す', () => {
    expect(toDoneUsage({})).toBeUndefined();
  });
});
