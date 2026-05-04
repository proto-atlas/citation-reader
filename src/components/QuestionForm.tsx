'use client';

import { useId } from 'react';

interface Props {
  question: string;
  onQuestionChange: (q: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isStreaming: boolean;
  canSubmit: boolean;
}

export function QuestionForm({
  question,
  onQuestionChange,
  onSubmit,
  onCancel,
  isStreaming,
  canSubmit,
}: Props) {
  const textareaId = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !isStreaming) onSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <label
        htmlFor={textareaId}
        className="text-base font-semibold text-slate-900 dark:text-slate-100"
      >
        質問
      </label>
      <textarea
        id={textareaId}
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="空白で要約のみ。具体的な質問を入力するとQ&Aモードになります。"
        disabled={isStreaming}
        rows={3}
        className="w-full rounded-lg border border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 disabled:opacity-50 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="flex justify-end">
        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg bg-red-700 hover:bg-red-800 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
          >
            キャンセル
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isStreaming}
            className="min-h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 dark:disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
          >
            質問する
          </button>
        )}
      </div>
    </form>
  );
}
