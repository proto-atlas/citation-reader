'use client';

import type { CitationLocation } from '@/lib/types';
import { renderInlineMarkdown } from '@/lib/markdown-inline';

export interface AnswerBlock {
  index: number;
  text: string;
  citations: CitationLocation[];
}

interface Props {
  blocks: AnswerBlock[];
  onCitationClick: (citation: CitationLocation) => void;
  hoveredCitationKey: string | null;
  onCitationHover: (key: string | null) => void;
  isStreaming: boolean;
}

export function AnswerView({
  blocks,
  onCitationClick,
  hoveredCitationKey,
  onCitationHover,
  isStreaming,
}: Props) {
  if (blocks.length === 0 && !isStreaming) {
    return (
      // text-slate-400 はライト背景でコントラスト不足 (axe-core 検出)。
      // 600/400 で WCAG AA 達成。
      <div className="rounded-lg border border-dashed border-slate-400 dark:border-slate-700 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        回答がここに表示されます。
      </div>
    );
  }

  const flatCitations: { key: string; n: number; citation: CitationLocation }[] = [];
  const lookupKey = (c: CitationLocation) =>
    `${c.document_index}-${c.start_char_index ?? c.start_page_number ?? c.start_block_index ?? 0}-${c.cited_text.slice(0, 40)}`;
  const keyToNumber = new Map<string, number>();
  for (const block of blocks) {
    for (const c of block.citations) {
      const key = lookupKey(c);
      if (!keyToNumber.has(key)) {
        const n = keyToNumber.size + 1;
        keyToNumber.set(key, n);
        flatCitations.push({ key, n, citation: c });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
        <div className="prose prose-slate dark:prose-invert max-w-none text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
          {blocks.map((block) => (
            <span key={block.index}>
              {/* Markdown 記法 (`**bold**` / `*italic*` / `` `code` ``) を
                  inline 要素にレンダリング。引用バッジは text と並列に挿入する
                  既存構造を保つので、citation 同期は壊れない (markdown-inline.test.ts
                  でレンダリング順序を保証)。SYSTEM_PROMPT の Markdown 禁止指示と
                  二重防御。 */}
              {renderInlineMarkdown(block.text)}
              {block.citations.map((c, ci) => {
                const key = lookupKey(c);
                const n = keyToNumber.get(key) ?? 0;
                const active = hoveredCitationKey === key;
                return (
                  <button
                    key={`${block.index}-${ci}-${key}`}
                    type="button"
                    onClick={() => onCitationClick(c)}
                    onMouseEnter={() => onCitationHover(key)}
                    onMouseLeave={() => onCitationHover(null)}
                    className={`mx-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-50 dark:hover:bg-emerald-800'
                    }`}
                    title={c.cited_text}
                    aria-label={`引用元 ${n}: ${c.cited_text.slice(0, 50)}`}
                  >
                    {n}
                  </button>
                );
              })}
            </span>
          ))}
          {isStreaming && (
            <span className="ml-1 inline-block h-3 w-2 animate-pulse bg-slate-400 align-middle" />
          )}
        </div>
      </div>

      {flatCitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            引用元 ({flatCitations.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {flatCitations.map(({ key, n, citation }) => {
              const active = hoveredCitationKey === key;
              return (
                // li 自体は role 不変 (リスト構造の意味は残す)、操作可能要素は内側の button。
                // 引用元リストはキーボード操作にも対応する。
                // li onClick から button に変更してキーボード操作 (Enter / Space) と
                // タッチ 44px 高さを確保する。
                <li key={key} className="contents">
                  <button
                    type="button"
                    onClick={() => onCitationClick(citation)}
                    onMouseEnter={() => onCitationHover(key)}
                    onMouseLeave={() => onCitationHover(null)}
                    onFocus={() => onCitationHover(key)}
                    onBlur={() => onCitationHover(null)}
                    aria-label={`引用元 ${n}: ${citation.cited_text.slice(0, 80)}`}
                    className={`w-full cursor-pointer rounded-lg border p-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      active
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span className="mb-1 flex items-center gap-2">
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-700 px-1 text-[11px] font-semibold text-white">
                        {n}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatLocation(citation)}
                      </span>
                    </span>
                    <span className="block italic text-slate-800 dark:text-slate-200">
                      「{citation.cited_text}」
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatLocation(c: CitationLocation): string {
  if (c.type === 'char_location') {
    return `${c.start_char_index}-${c.end_char_index}文字目`;
  }
  if (c.type === 'page_location') {
    return `${c.start_page_number}-${c.end_page_number}ページ`;
  }
  return `${c.start_block_index}-${c.end_block_index}ブロック`;
}
