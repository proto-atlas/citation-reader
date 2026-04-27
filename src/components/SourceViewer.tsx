'use client';

import { useEffect, useRef } from 'react';
import type { CitationLocation } from '@/lib/types';

interface Props {
  documentText: string;
  citation: CitationLocation;
  onClose: () => void;
}

const CONTEXT_RADIUS = 200;

export function SourceViewer({ documentText, citation, onClose }: Props) {
  const highlightRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [citation]);

  const fallback =
    citation.start_char_index === undefined
      ? findCitedTextWithAmbiguity(documentText, citation.cited_text)
      : { start: citation.start_char_index, ambiguous: false };
  const start = citation.start_char_index ?? fallback.start;
  const end = citation.end_char_index ?? (start >= 0 ? start + citation.cited_text.length : -1);
  const ambiguous = fallback.ambiguous;

  if (start < 0) {
    return (
      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4 text-xs">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">引用元</h3>
          <button
            onClick={onClose}
            className="rounded-md px-1 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-slate-300"
          >
            閉じる ×
          </button>
        </div>
        <p className="text-amber-800 dark:text-amber-200">
          PDF等のテキスト以外のソースからの引用です。引用テキスト:
        </p>
        <p className="mt-2 italic text-slate-700 dark:text-slate-300">「{citation.cited_text}」</p>
      </div>
    );
  }

  const contextStart = Math.max(0, start - CONTEXT_RADIUS);
  const contextEnd = Math.min(documentText.length, end + CONTEXT_RADIUS);
  const before = documentText.slice(contextStart, start);
  const cited = documentText.slice(start, end);
  const after = documentText.slice(end, contextEnd);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          引用元プレビュー
        </h3>
        <button
          onClick={onClose}
          className="rounded-md px-1 text-xs text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-slate-300"
        >
          閉じる ×
        </button>
      </div>
      {ambiguous && (
        <p className="mb-2 rounded bg-amber-50 dark:bg-amber-950 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200">
          同じ文面が文書内に複数存在するため、最初に出現した箇所を表示しています。
        </p>
      )}
      <div className="max-h-[300px] overflow-y-auto rounded-md bg-slate-50 dark:bg-slate-900 p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {contextStart > 0 && <span className="text-slate-400">…</span>}
        <span className="whitespace-pre-wrap">{before}</span>
        <span
          ref={highlightRef}
          className="rounded bg-emerald-200 dark:bg-emerald-800 px-0.5 font-semibold text-slate-900 dark:text-slate-100"
        >
          {cited}
        </span>
        <span className="whitespace-pre-wrap">{after}</span>
        {contextEnd < documentText.length && <span className="text-slate-400">…</span>}
      </div>
    </div>
  );
}

/**
 * page_location / content_block_location 由来の引用で char 位置が無い場合の
 * フォールバック検索。同一文面が複数箇所にあるときは警告表示用に ambiguous を返す。
 */
function findCitedTextWithAmbiguity(
  documentText: string,
  citedText: string,
): { start: number; ambiguous: boolean } {
  if (!citedText) return { start: -1, ambiguous: false };
  const first = documentText.indexOf(citedText);
  if (first < 0) return { start: -1, ambiguous: false };
  const second = documentText.indexOf(citedText, first + 1);
  return { start: first, ambiguous: second >= 0 };
}
