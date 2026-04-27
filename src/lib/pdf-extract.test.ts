import { describe, expect, it } from 'vitest';
import { buildPageText, normalizeExtractedText } from './pdf-extract';

describe('buildPageText', () => {
  it('strが未定義のitemはスキップする', () => {
    expect(buildPageText([{ str: undefined }, { str: 'abc' }])).toBe('abc');
  });

  it('hasEOL=trueなら改行を差し込む', () => {
    expect(buildPageText([{ str: 'line1', hasEOL: true }, { str: 'line2' }])).toBe('line1\nline2');
  });

  it('hasEOLが無ければ改行を差し込まない', () => {
    expect(buildPageText([{ str: 'a' }, { str: 'b' }])).toBe('ab');
  });

  it('日本語の文字単位アイテムでも空白を挿入しない（ルビ崩れ回避）', () => {
    expect(buildPageText([{ str: '令' }, { str: '和' }])).toBe('令和');
  });

  it('空配列は空文字列を返す', () => {
    expect(buildPageText([])).toBe('');
  });
});

describe('normalizeExtractedText', () => {
  it('ページ間を空行1つ（\\n\\n）で結合する', () => {
    expect(normalizeExtractedText(['page1', 'page2'])).toBe('page1\n\npage2');
  });

  it('連続する半角スペースは1つに圧縮する', () => {
    expect(normalizeExtractedText(['a    b'])).toBe('a b');
  });

  it('連続するタブは1スペースに圧縮する', () => {
    expect(normalizeExtractedText(['a\t\tb'])).toBe('a b');
  });

  it('行頭の空白は削除する', () => {
    expect(normalizeExtractedText(['a\n    b'])).toBe('a\nb');
  });

  it('空行3つ以上は2つに圧縮する', () => {
    expect(normalizeExtractedText(['a\n\n\n\nb'])).toBe('a\n\nb');
  });

  it('前後の空白をトリムする', () => {
    expect(normalizeExtractedText(['   abc   '])).toBe('abc');
  });

  it('空ページテキストを含んでも結合できる', () => {
    expect(normalizeExtractedText(['a', '', 'b'])).toBe('a\n\nb');
  });
});
