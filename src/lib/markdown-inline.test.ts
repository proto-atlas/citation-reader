import { describe, expect, it } from 'vitest';
import { _tokenizeForTest } from './markdown-inline';

describe('tokenize (markdown-inline)', () => {
  it('Markdown 記法を含まないプレーンテキストは 1 セグメント', () => {
    const r = _tokenizeForTest('プレーンな日本語の回答です。');
    expect(r).toEqual(['プレーンな日本語の回答です。']);
  });

  it('**bold** を strong トークンに変換する', () => {
    const r = _tokenizeForTest('これは **重要** な点です。');
    expect(r).toEqual(['これは ', { tag: 'strong', content: '重要' }, ' な点です。']);
  });

  it('*italic* を em トークンに変換する', () => {
    const r = _tokenizeForTest('これは *斜体* です。');
    expect(r).toEqual(['これは ', { tag: 'em', content: '斜体' }, ' です。']);
  });

  it('`code` を code トークンに変換する', () => {
    const r = _tokenizeForTest('関数 `foo` を呼ぶ。');
    expect(r).toEqual(['関数 ', { tag: 'code', content: 'foo' }, ' を呼ぶ。']);
  });

  it('** が * よりも先に処理される (lookahead 競合回避)', () => {
    const r = _tokenizeForTest('**bold** と *italic* と `code`');
    expect(r).toEqual([
      { tag: 'strong', content: 'bold' },
      ' と ',
      { tag: 'em', content: 'italic' },
      ' と ',
      { tag: 'code', content: 'code' },
    ]);
  });

  it('単独の * は変換しない', () => {
    const r = _tokenizeForTest('5 * 3 = 15');
    // `*` は前後にスペース / 数字なのでパターン外。素通り
    expect(r).toEqual(['5 * 3 = 15']);
  });

  it('改行を跨ぐ ** は変換しない (`[^*\\n]+?` で禁止)', () => {
    const r = _tokenizeForTest('**\nbold\n** だけ');
    // 改行を含むので strong パターンにマッチせずプレーン扱い
    expect(r[0]).toContain('**');
  });

  it('複数の **bold** が連続しても全部変換する', () => {
    const r = _tokenizeForTest('**A** と **B** と **C**');
    expect(r).toEqual([
      { tag: 'strong', content: 'A' },
      ' と ',
      { tag: 'strong', content: 'B' },
      ' と ',
      { tag: 'strong', content: 'C' },
    ]);
  });

  it('空文字は空配列を返す (置換ループで初期 [""] が落ちる)', () => {
    const r = _tokenizeForTest('');
    expect(r).toEqual([]);
  });

  it('Markdown と通常文が混在しても順序を保つ', () => {
    const r = _tokenizeForTest('前 **強調** 中 *斜体* 後');
    expect(r).toEqual([
      '前 ',
      { tag: 'strong', content: '強調' },
      ' 中 ',
      { tag: 'em', content: '斜体' },
      ' 後',
    ]);
  });
});
