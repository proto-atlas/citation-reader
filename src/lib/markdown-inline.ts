/**
 * Inline MarkdownをReact Node配列に変換する純関数。
 *
 * SYSTEM_PROMPTでMarkdown禁止を
 * prompt依存で抑止する現状を、UI側のレンダリングで担保する設計に補強する。
 *
 * 採用方針:
 * - react-markdown + rehype-sanitize等の依存追加はnpm audit影響を増やすため
 *   不採用。最小限のinline記法 (`**bold**` / `*italic*` / `` `code` ``) のみを
 *   `<strong>` / `<em>` / `<code>` に変換する自前パーサーを使う
 * - 変換は純関数で、入力textの構造 (引用バッジを別配列で並列挿入する仕組み) を
 *   壊さない。AnswerView.tsx側は `block.text` を `renderInlineMarkdown(block.text)`
 *   に置換するだけでOK
 * - block / 改行レベル (heading、list、table) はサポートしない。LLMが `**...**`
 *   を出した場合の救済が目的で、リッチMarkdownは禁止prompt維持
 *
 * 引用バッジ同期: 本関数は 1 blockのtextのみを変換するため、AnswerView.tsxで
 * `<span>{renderInlineMarkdown(block.text)}{citations.map(...)}</span>` の構造を
 * 維持する限り、引用バッジの挿入位置は変わらない。
 */
import { createElement, Fragment, type ReactNode } from 'react';

interface Marker {
  re: RegExp;
  tag: 'strong' | 'em' | 'code';
}

// 順序が重要: `**` → `*` の順 (`*` パターンが `**` をfoodにしないようlookahead/behindで守る)
const MARKERS: Marker[] = [
  { re: /\*\*([^*\n]+?)\*\*/g, tag: 'strong' },
  { re: /(?<!\*)\*([^*\n]+?)\*(?!\*)/g, tag: 'em' },
  { re: /`([^`\n]+?)`/g, tag: 'code' },
];

type Segment = string | { tag: 'strong' | 'em' | 'code'; content: string };

function tokenize(text: string): Segment[] {
  let segments: Segment[] = [text];
  for (const { re, tag } of MARKERS) {
    const next: Segment[] = [];
    for (const seg of segments) {
      if (typeof seg !== 'string') {
        next.push(seg);
        continue;
      }
      const newRe = new RegExp(re.source, re.flags);
      let lastIdx = 0;
      let match: RegExpExecArray | null;
      while ((match = newRe.exec(seg))) {
        if (match.index > lastIdx) next.push(seg.slice(lastIdx, match.index));
        next.push({ tag, content: match[1] ?? '' });
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < seg.length) next.push(seg.slice(lastIdx));
    }
    segments = next;
  }
  return segments;
}

export function renderInlineMarkdown(text: string): ReactNode {
  if (!text) return text;
  const segments = tokenize(text);
  // 単一セグメント (Markdownなし) はそのまま返して余計なFragmentを作らない
  if (segments.length === 1 && typeof segments[0] === 'string') return segments[0];
  return createElement(
    Fragment,
    null,
    ...segments.map((seg, i) => {
      if (typeof seg === 'string') return seg;
      return createElement(seg.tag, { key: i }, seg.content);
    }),
  );
}

// テスト / デバッグ用: tokenizeの生結果を返す
export function _tokenizeForTest(text: string): Segment[] {
  return tokenize(text);
}
