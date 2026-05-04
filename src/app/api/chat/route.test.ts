import { describe, expect, test } from 'vitest';
import { parseChatRequest } from './route';

describe('parseChatRequest', () => {
  const max = { doc: 20, q: 10 };

  test('documentTextとquestionが文字列ならtrimしてChatRequestを返す', () => {
    expect(
      parseChatRequest({ documentText: '  short document  ', question: '  要約して  ' }, max),
    ).toEqual({
      ok: true,
      value: { documentText: 'short document', question: '要約して' },
    });
  });

  test('questionが空ならdocumentTextだけのChatRequestを返す', () => {
    expect(parseChatRequest({ documentText: 'short document', question: '   ' }, max)).toEqual({
      ok: true,
      value: { documentText: 'short document' },
    });
  });

  test('object以外を渡すとinvalid_inputを返す', () => {
    expect(parseChatRequest(null, max)).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseChatRequest('text', max)).toEqual({ ok: false, code: 'invalid_input' });
  });

  test('documentTextが空ならinvalid_inputを返す', () => {
    expect(parseChatRequest({ documentText: '   ', question: '要約して' }, max)).toEqual({
      ok: false,
      code: 'invalid_input',
    });
  });

  test('documentTextが上限を超えるとdocument_too_longを返す', () => {
    expect(parseChatRequest({ documentText: 'x'.repeat(21), question: '要約して' }, max)).toEqual({
      ok: false,
      code: 'document_too_long',
    });
  });

  test('questionが上限を超えるとquestion_too_longを返す', () => {
    expect(
      parseChatRequest({ documentText: 'short document', question: 'x'.repeat(11) }, max),
    ).toEqual({
      ok: false,
      code: 'question_too_long',
    });
  });
});
