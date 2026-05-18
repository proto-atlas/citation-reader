'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentInput } from '@/components/DocumentInput';
import { QuestionForm } from '@/components/QuestionForm';
import { AnswerView, type AnswerBlock } from '@/components/AnswerView';
import { SourceViewer } from '@/components/SourceViewer';
import { PasswordGate } from '@/components/PasswordGate';
import { ThemeToggle } from '@/components/ThemeToggle';
import { streamChat } from '@/lib/sse-client';
import { MODEL_LABEL } from '@/lib/models';
import { labelFor } from '@/lib/error-labels';
import type { CitationLocation } from '@/lib/types';

interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export default function Home() {
  return (
    <PasswordGate>
      {(password, clearPassword) => (
        <CitationReaderApp password={password} onLogout={clearPassword} />
      )}
    </PasswordGate>
  );
}

function CitationReaderApp({ password, onLogout }: { password: string; onLogout: () => void }) {
  const [documentText, setDocumentText] = useState('');
  const [question, setQuestion] = useState('');
  const [blocks, setBlocks] = useState<AnswerBlock[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [highlightCitation, setHighlightCitation] = useState<CitationLocation | null>(null);
  const [hoveredCitationKey, setHoveredCitationKey] = useState<string | null>(null);
  // キャンセル直後のクールダウン。
  // Cloudflare Workers のログで、1 回のキャンセル後に 2 秒間隔で自動再送信が 4 回
  // 発生するケースを観測した (ユーザー連打 or ブラウザの fetch retry 由来)。
  // isStreaming=false への切替直後にも再送信を遮断するため、2 秒のロック期間を設ける。
  const [cooldownActive, setCooldownActive] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setTimeout(() => setCooldownActive(false), 2000);
    return () => clearTimeout(timer);
  }, [cooldownActive]);

  const canSubmit = useMemo(
    () => documentText.trim().length > 0 && !isStreaming && !cooldownActive,
    [documentText, isStreaming, cooldownActive],
  );

  const handleSubmit = useCallback(async () => {
    // 二重送信ガード: canSubmit と重複するが、念のためロジック層でも遮断。
    // ブラウザの fetch retry 等で handleSubmit が意図せず呼ばれるケースを防ぐ。
    if (isStreaming || cooldownActive) return;
    setBlocks([]);
    setError(null);
    setUsage(null);
    setActiveModel(null);
    setHighlightCitation(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        {
          documentText,
          question: question.trim() || undefined,
        },
        password,
        {
          onMeta: (e) => setActiveModel(e.model),
          onText: (e) => {
            setBlocks((prev) => upsertText(prev, e.index, e.text));
          },
          onCitation: (e) => {
            setBlocks((prev) => upsertCitation(prev, e.index, e.citation));
          },
          onError: (e) => setError(labelFor(e.code)),
          onDone: (e) => {
            if (e.usage) setUsage(e.usage);
          },
          onUnauthorized: () => {
            onLogout();
          },
        },
        controller.signal,
      );
    } catch (err) {
      // ネットワーク失敗等の例外は raw message を出さず、汎用文言で表示する
      // (OWASP Improper Error Handling 対応)。
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(labelFor('upstream_unavailable'));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [documentText, question, password, onLogout, isStreaming, cooldownActive]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    // 2 秒間は新規送信を受け付けない (ユーザー連打 / 自動再送信対策)
    setCooldownActive(true);
  }, []);

  const handleCitationClick = useCallback((citation: CitationLocation) => {
    setHighlightCitation(citation);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">citation-reader</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={onLogout}
              // 44px タッチターゲット + WCAG AA コントラスト (slate-700/300)
              className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-xs text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:text-slate-100"
            >
              ログアウト
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          引用元付きの要約・Q&A。Anthropic Citations API + Prompt Caching、{MODEL_LABEL} で動作。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="flex flex-col gap-6">
          <DocumentInput
            documentText={documentText}
            onChange={setDocumentText}
            disabled={isStreaming}
          />
          <QuestionForm
            question={question}
            onQuestionChange={setQuestion}
            onSubmit={() => void handleSubmit()}
            onCancel={handleCancel}
            isStreaming={isStreaming}
            canSubmit={canSubmit}
          />
          {(activeModel || usage) && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-400">
              {activeModel && (
                <p>
                  <span className="font-medium">モデル:</span> {activeModel}
                </p>
              )}
              {usage && (
                <p className="mt-1">
                  <span className="font-medium">トークン:</span> 入力{' '}
                  {usage.input_tokens.toLocaleString()} / 出力{' '}
                  {usage.output_tokens.toLocaleString()}
                  {usage.cache_creation_input_tokens !== undefined &&
                    usage.cache_creation_input_tokens > 0 && (
                      <> (キャッシュ書込 {usage.cache_creation_input_tokens.toLocaleString()})</>
                    )}
                  {usage.cache_read_input_tokens !== undefined &&
                    usage.cache_read_input_tokens > 0 && (
                      <> (キャッシュ読込 {usage.cache_read_input_tokens.toLocaleString()})</>
                    )}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-6">
          {error && (
            <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
          <AnswerView
            blocks={blocks}
            onCitationClick={handleCitationClick}
            hoveredCitationKey={hoveredCitationKey}
            onCitationHover={setHoveredCitationKey}
            isStreaming={isStreaming}
          />
          {highlightCitation && (
            <SourceViewer
              documentText={documentText}
              citation={highlightCitation}
              onClose={() => setHighlightCitation(null)}
            />
          )}
        </section>
      </div>

      <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs text-slate-500 dark:text-slate-400">
        Next.js + Cloudflare Workers で構築。
        ドキュメントはブラウザ側で処理され、サーバーには保存されません。
      </footer>
    </main>
  );
}

function upsertText(blocks: AnswerBlock[], index: number, text: string): AnswerBlock[] {
  const existing = blocks.find((b) => b.index === index);
  if (existing) {
    return blocks.map((b) => (b.index === index ? { ...b, text: b.text + text } : b));
  }
  return [...blocks, { index, text, citations: [] }].sort((a, b) => a.index - b.index);
}

function upsertCitation(
  blocks: AnswerBlock[],
  index: number,
  citation: CitationLocation,
): AnswerBlock[] {
  const existing = blocks.find((b) => b.index === index);
  if (existing) {
    return blocks.map((b) =>
      b.index === index ? { ...b, citations: [...b.citations, citation] } : b,
    );
  }
  return [...blocks, { index, text: '', citations: [citation] }].sort((a, b) => a.index - b.index);
}
