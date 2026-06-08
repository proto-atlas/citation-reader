import { describe, expect, it } from 'vitest';
import {
  checkLanguageMatch,
  detectMarkdownLeak,
  evaluateTurn,
  summarizeCitations,
} from './evaluators';
import type { CitationLocation } from '@/lib/types';

const validCitation: CitationLocation = {
  type: 'char_location',
  cited_text: '本文の引用元',
  document_index: 0,
};

describe('detectMarkdownLeak', () => {
  it('Markdown記法を含まないプレーンテキストはleaked=false', () => {
    const r = detectMarkdownLeak('これはプレーンな日本語の回答です。');
    expect(r.leaked).toBe(false);
    expect(r.matchedPatterns).toEqual([]);
  });

  it('**bold** を検出する', () => {
    const r = detectMarkdownLeak('これは **重要** な点です。');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('bold (**...**)');
  });

  it('# headingを検出する', () => {
    const r = detectMarkdownLeak('# 見出し\n本文');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('heading (#)');
  });

  it('``` code fenceを検出する', () => {
    const r = detectMarkdownLeak('```\ncode\n```');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('code fence (```)');
  });

  it('inline `code` を検出する', () => {
    const r = detectMarkdownLeak('関数 `foo` を呼ぶ。');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('inline code (`...`)');
  });

  it('list bullet (- ) を検出する', () => {
    const r = detectMarkdownLeak('- 項目 1\n- 項目 2');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('list bullet (^- )');
  });

  it('numbered list (1. ) を検出する', () => {
    const r = detectMarkdownLeak('1. 第一\n2. 第二');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('numbered list (^1. )');
  });

  it('[text](url) linkを検出する', () => {
    const r = detectMarkdownLeak('詳細は [docs](https://example.com) を参照。');
    expect(r.leaked).toBe(true);
    expect(r.matchedPatterns).toContain('link [text](url)');
  });

  it('複数パターン同時混入も全部報告する', () => {
    const r = detectMarkdownLeak('# H\n**B**\n- l');
    expect(r.matchedPatterns.length).toBeGreaterThanOrEqual(3);
  });
});

describe('checkLanguageMatch', () => {
  it('日本語回答 + 質問jaでmatched=true', () => {
    const r = checkLanguageMatch('これは日本語の要約です。', 'ja');
    expect(r.matched).toBe(true);
    expect(r.detectedLanguage).toBe('ja');
  });

  it('英語回答 + 質問enでmatched=true', () => {
    const r = checkLanguageMatch('This is the English summary.', 'en');
    expect(r.matched).toBe(true);
    expect(r.detectedLanguage).toBe('en');
  });

  it('英語回答 + 質問jaでmatched=false (言語ミスマッチ)', () => {
    const r = checkLanguageMatch('This is English text.', 'ja');
    expect(r.matched).toBe(false);
    expect(r.detectedLanguage).toBe('en');
  });

  it('日本語回答 + 質問enでmatched=false', () => {
    const r = checkLanguageMatch('これは日本語です。', 'en');
    expect(r.matched).toBe(false);
    expect(r.detectedLanguage).toBe('ja');
  });

  it('空文字はdetectedLanguage=unknown / matched=false', () => {
    const r = checkLanguageMatch('', 'ja');
    expect(r.matched).toBe(false);
    expect(r.detectedLanguage).toBe('unknown');
  });

  it('数字記号のみはdetectedLanguage=unknown', () => {
    const r = checkLanguageMatch('123 456 789', 'en');
    expect(r.detectedLanguage).toBe('unknown');
  });
});

describe('summarizeCitations', () => {
  it('空配列はcount=0 / unique=0 / duplicateRate=0', () => {
    const r = summarizeCitations([]);
    expect(r.count).toBe(0);
    expect(r.uniqueCitedTextCount).toBe(0);
    expect(r.duplicateRate).toBe(0);
  });

  it('全ユニークならduplicateRate=0', () => {
    const r = summarizeCitations([
      { ...validCitation, cited_text: 'A' },
      { ...validCitation, cited_text: 'B' },
      { ...validCitation, cited_text: 'C' },
    ]);
    expect(r.count).toBe(3);
    expect(r.uniqueCitedTextCount).toBe(3);
    expect(r.duplicateRate).toBe(0);
  });

  it('半分重複ならduplicateRate=0.5', () => {
    const r = summarizeCitations([
      { ...validCitation, cited_text: 'A' },
      { ...validCitation, cited_text: 'A' },
      { ...validCitation, cited_text: 'B' },
      { ...validCitation, cited_text: 'B' },
    ]);
    expect(r.count).toBe(4);
    expect(r.uniqueCitedTextCount).toBe(2);
    expect(r.duplicateRate).toBe(0.5);
  });
});

describe('evaluateTurn', () => {
  it('Markdown漏れなし + 言語一致 + 引用ありならpassed=true', () => {
    const r = evaluateTurn({
      text: 'これは日本語の要約で、原文に基づいています。',
      citations: [validCitation],
      questionLanguage: 'ja',
    });
    expect(r.passed).toBe(true);
  });

  it('Markdown漏れがあればpassed=false', () => {
    const r = evaluateTurn({
      text: '**重要** な点です。',
      citations: [validCitation],
      questionLanguage: 'ja',
    });
    expect(r.passed).toBe(false);
    expect(r.markdown.leaked).toBe(true);
  });

  it('言語ミスマッチならpassed=false', () => {
    const r = evaluateTurn({
      text: 'This is English.',
      citations: [validCitation],
      questionLanguage: 'ja',
    });
    expect(r.passed).toBe(false);
    expect(r.language.matched).toBe(false);
  });

  it('引用 0 件ならpassed=false', () => {
    const r = evaluateTurn({
      text: 'これは日本語の回答です。',
      citations: [],
      questionLanguage: 'ja',
    });
    expect(r.passed).toBe(false);
    expect(r.citations.count).toBe(0);
  });

  it('重複率 50% 以上ならpassed=false', () => {
    const r = evaluateTurn({
      text: 'これは日本語の回答です。',
      citations: [
        { ...validCitation, cited_text: 'A' },
        { ...validCitation, cited_text: 'A' },
        { ...validCitation, cited_text: 'A' },
      ],
      questionLanguage: 'ja',
    });
    expect(r.passed).toBe(false);
    expect(r.citations.duplicateRate).toBeGreaterThanOrEqual(0.5);
  });
});
