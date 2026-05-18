/**
 * LLM 出力品質の評価関数群。
 *
 * `/api/chat` の SSE 出力を集約した「回答テキスト + 引用配列」を
 * 入力に取り、以下 3 つの評価軸で品質を機械的に検査する。
 *
 *   1. Markdown 混入: 回答テキストに `**bold**` / `# heading` / ` ``` ` などが残っていないか
 *   2. 言語一致: 質問が日本語なら回答も日本語、英語なら英語かどうか
 *   3. 引用件数 / 引用 cited_text の重複
 *
 * すべて純関数なので Vitest で単体テスト可能。実 Anthropic API 呼び出しは
 * `eval/runner.mjs` が別途行い、結果オブジェクトを本モジュールに渡す設計。
 */

import type { CitationLocation } from '@/lib/types';

export interface ChatTurnSummary {
  text: string;
  citations: CitationLocation[];
  questionLanguage: 'ja' | 'en';
}

export interface MarkdownLeakResult {
  leaked: boolean;
  matchedPatterns: string[];
}

export interface LanguageCheckResult {
  matched: boolean;
  detectedLanguage: 'ja' | 'en' | 'mixed' | 'unknown';
}

export interface CitationStatsResult {
  count: number;
  uniqueCitedTextCount: number;
  duplicateRate: number; // 0..1
}

const MARKDOWN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'bold (**...**)', re: /\*\*[^*\n]+\*\*/ },
  { name: 'italic (*...*)', re: /(^|[\s>])\*[^*\n]+\*(?=$|[\s.,!?])/ },
  { name: 'heading (#)', re: /^#{1,6}\s/m },
  { name: 'code fence (```)', re: /```/ },
  { name: 'inline code (`...`)', re: /`[^`\n]+`/ },
  { name: 'list bullet (^- )', re: /^[-*+]\s/m },
  { name: 'numbered list (^1. )', re: /^\d+\.\s/m },
  { name: 'link [text](url)', re: /\[[^\]]+\]\([^)]+\)/ },
];

/**
 * 回答テキストに Markdown 記法が混入していないか検査する。
 * SYSTEM_PROMPT に Markdown 禁止を明記しているが、LLM 出力は非決定的
 * なので、評価ハーネスでも独立して検出する。
 */
export function detectMarkdownLeak(text: string): MarkdownLeakResult {
  const matched: string[] = [];
  for (const { name, re } of MARKDOWN_PATTERNS) {
    if (re.test(text)) matched.push(name);
  }
  return {
    leaked: matched.length > 0,
    matchedPatterns: matched,
  };
}

/**
 * 回答が質問の言語と一致しているか検査する。
 * 文字種ベースの簡易判定 (CJK 比率 > 0.05 なら ja、ASCII 比率 > 0.95 なら en)。
 * 厳密な言語検出ではないが、ja/en の取り違えは検出できる。
 */
export function checkLanguageMatch(
  text: string,
  questionLanguage: 'ja' | 'en',
): LanguageCheckResult {
  if (text.length === 0) return { matched: false, detectedLanguage: 'unknown' };
  let cjkCount = 0;
  let asciiLetterCount = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK Unified Ideographs + ひらがな + カタカナの主要範囲
    if (
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff) || // Katakana
      (code >= 0x4e00 && code <= 0x9fff) // CJK Unified Ideographs
    ) {
      cjkCount += 1;
    } else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      asciiLetterCount += 1;
    }
  }
  const total = cjkCount + asciiLetterCount;
  if (total === 0) return { matched: false, detectedLanguage: 'unknown' };
  const cjkRatio = cjkCount / total;
  const detected: LanguageCheckResult['detectedLanguage'] =
    cjkRatio > 0.5 ? 'ja' : cjkRatio < 0.05 ? 'en' : 'mixed';
  return { matched: detected === questionLanguage, detectedLanguage: detected };
}

/**
 * 引用配列の件数と重複率を集計する。
 * citation 0 件の回答や同一 cited_text を多重引用する回答を検出できる。
 */
export function summarizeCitations(citations: CitationLocation[]): CitationStatsResult {
  const count = citations.length;
  if (count === 0) return { count: 0, uniqueCitedTextCount: 0, duplicateRate: 0 };
  const unique = new Set(citations.map((c) => c.cited_text));
  const uniqueCount = unique.size;
  const duplicateRate = (count - uniqueCount) / count;
  return { count, uniqueCitedTextCount: uniqueCount, duplicateRate };
}

/**
 * 1 ターンの会話結果を 3 軸で評価して合否を 1 オブジェクトで返す。
 * runner.mjs はこれを sample-cases.json の各ケースに対して実行し集計する。
 */
export interface TurnEvalReport {
  markdown: MarkdownLeakResult;
  language: LanguageCheckResult;
  citations: CitationStatsResult;
  passed: boolean;
}

export function evaluateTurn(turn: ChatTurnSummary): TurnEvalReport {
  const markdown = detectMarkdownLeak(turn.text);
  const language = checkLanguageMatch(turn.text, turn.questionLanguage);
  const citations = summarizeCitations(turn.citations);
  // 合格条件: Markdown 漏れなし + 言語一致 + 引用 1 件以上 + 重複率 50% 未満
  const passed =
    !markdown.leaked && language.matched && citations.count > 0 && citations.duplicateRate < 0.5;
  return { markdown, language, citations, passed };
}
