// route.ts は Next.js 環境を要求する POST ハンドラを export しているが、
// parseChatRequest は純関数として export しているのでこちらだけ単体テストする。
// POST 全体は E2E (Playwright) でカバー。
import { describe, expect, it } from 'vitest';
import { parseChatRequest } from './route';

const MAX = { doc: 200_000, q: 1_000 };

describe('parseChatRequest', () => {
  it('null / undefined / プリミティブで invalid_input', () => {
    expect(parseChatRequest(null, MAX)).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseChatRequest(undefined, MAX)).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseChatRequest('hello', MAX)).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseChatRequest(42, MAX)).toEqual({ ok: false, code: 'invalid_input' });
  });

  it('documentText が無い / 空 / 文字列でない場合は invalid_input', () => {
    expect(parseChatRequest({}, MAX)).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseChatRequest({ documentText: '' }, MAX)).toEqual({
      ok: false,
      code: 'invalid_input',
    });
    expect(parseChatRequest({ documentText: '   ' }, MAX)).toEqual({
      ok: false,
      code: 'invalid_input',
    });
    expect(parseChatRequest({ documentText: 42 }, MAX)).toEqual({
      ok: false,
      code: 'invalid_input',
    });
    expect(parseChatRequest({ documentText: null }, MAX)).toEqual({
      ok: false,
      code: 'invalid_input',
    });
  });

  it('documentText が上限超で document_too_long', () => {
    const long = 'a'.repeat(MAX.doc + 1);
    expect(parseChatRequest({ documentText: long }, MAX)).toEqual({
      ok: false,
      code: 'document_too_long',
    });
  });

  it('question が上限超で question_too_long', () => {
    const long = 'q'.repeat(MAX.q + 1);
    expect(parseChatRequest({ documentText: 'doc', question: long }, MAX)).toEqual({
      ok: false,
      code: 'question_too_long',
    });
  });

  it('question が文字列以外でも空扱いで通る (question 省略相当)', () => {
    const result = parseChatRequest({ documentText: 'doc', question: 42 }, MAX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ documentText: 'doc' });
  });

  it('正常系: documentText のみ', () => {
    const result = parseChatRequest({ documentText: 'hello' }, MAX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ documentText: 'hello' });
  });

  it('正常系: documentText + question', () => {
    const result = parseChatRequest({ documentText: 'hello', question: '何が書いてある?' }, MAX);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value).toEqual({ documentText: 'hello', question: '何が書いてある?' });
  });

  it('前後空白は trim される', () => {
    const result = parseChatRequest({ documentText: '  hello  ', question: '  ?  ' }, MAX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ documentText: 'hello', question: '?' });
  });

  it('未知のプロパティは無視される (forward compat)', () => {
    const result = parseChatRequest({ documentText: 'doc', metadata: { user: 'x' } }, MAX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ documentText: 'doc' });
  });
});
