import { describe, expect, test } from 'vitest';
import {
  aggregateChatEvents,
  buildLiveSampleResult,
  parseSseEvents,
  validateCitationBatchForEvidence,
} from './sse-utils.mjs';

describe('live evaluation SSE utilities', () => {
  test('SSE本文を渡すとdata行だけをJSONイベントとして取り出す', () => {
    const body = [
      'event: message',
      'data: {"type":"meta","model":"test-model"}',
      '',
      ': keep-alive',
      '',
      'data: {"type":"text","text":"hello","index":0}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    expect(parseSseEvents(body)).toEqual([
      { type: 'meta', model: 'test-model' },
      { type: 'text', text: 'hello', index: 0 },
    ]);
  });

  test('chatイベントを渡すと回答本文と引用とusageを集約する', () => {
    const events = [
      { type: 'meta', model: 'test-model' },
      { type: 'text', text: 'hello ', index: 0 },
      { type: 'text', text: 'world', index: 0 },
      {
        type: 'citation',
        index: 0,
        citation: { type: 'char_location', cited_text: 'source', document_index: 0 },
      },
      { type: 'done', usage: { input_tokens: 10, output_tokens: 5 } },
    ];

    expect(aggregateChatEvents(events)).toEqual({
      model: 'test-model',
      text: 'hello world',
      citations: [{ type: 'char_location', cited_text: 'source', document_index: 0 }],
      errors: [],
      done: true,
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  });

  test('引用がないlive結果はpassed falseにする', () => {
    const aggregate = {
      text: 'answer',
      citations: [],
      errors: [],
      done: true,
      model: 'test-model',
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    expect(
      buildLiveSampleResult({
        id: 'sample',
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        events: [{ type: 'done' }],
        aggregate,
      }),
    ).toMatchObject({
      id: 'sample',
      passed: false,
      citationCount: 0,
      citationValidationStats: {
        received: 0,
        accepted: 0,
        droppedInvalidBounds: 0,
        droppedTextMismatch: 0,
        droppedMissingDocument: 0,
        droppedDuplicate: 0,
      },
      errors: [],
    });
  });

  test('evidence用citation statsでacceptedとdrop理由を集計する', () => {
    const valid = {
      type: 'char_location',
      cited_text: '根拠文',
      document_index: 0,
      start_char_index: 0,
      end_char_index: 3,
    };
    const result = validateCitationBatchForEvidence(
      [
        valid,
        valid,
        { type: 'char_location', cited_text: '別文書の根拠', document_index: 0 },
        { type: 'char_location', cited_text: '根拠文', document_index: 1 },
        { type: 'char_location', cited_text: 42, document_index: 0 },
      ],
      ['根拠文を含む本文'],
    );

    expect(result.stats).toEqual({
      received: 5,
      accepted: 1,
      droppedInvalidBounds: 1,
      droppedTextMismatch: 1,
      droppedMissingDocument: 1,
      droppedDuplicate: 1,
    });
    expect(result.citations).toHaveLength(1);
  });
});
