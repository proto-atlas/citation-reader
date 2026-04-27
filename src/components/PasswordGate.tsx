'use client';

import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { STORAGE_KEY } from '@/lib/auth';

interface Props {
  children: (password: string, clearPassword: () => void) => ReactNode;
}

async function verifyPassword(candidate: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { Authorization: `Bearer ${candidate}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PasswordGate({ children }: Props) {
  const [password, setPassword] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setHydrated(true);
      return;
    }
    // 保存されたアクセスキーをサーバー検証してからメイン UI を出す（失効キーは自動削除）
    setVerifying(true);
    void verifyPassword(stored).then((ok) => {
      if (ok) {
        setPassword(stored);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setVerifying(false);
      setHydrated(true);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const candidate = input.trim();
    if (!candidate) return;
    setError(null);
    setVerifying(true);
    const ok = await verifyPassword(candidate);
    setVerifying(false);
    if (ok) {
      localStorage.setItem(STORAGE_KEY, candidate);
      setPassword(candidate);
    } else {
      setError('アクセスキーが正しくありません。');
    }
  }

  function clearPassword() {
    localStorage.removeItem(STORAGE_KEY);
    setPassword(null);
    setInput('');
    setError(null);
  }

  if (!hydrated) return null;

  if (!password) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
        <div className="flex w-full flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              citation-reader
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              アクセスキーをご入力ください。
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              （ご案内のアクセスキーをお使いください）
            </p>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              アクセスキー
            </label>
            <input
              id={inputId}
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="アクセスキー"
              autoFocus
              autoComplete="current-password"
              disabled={verifying}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-h-11 w-full rounded-md border border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            />
            {error && (
              <p id={errorId} className="text-xs text-red-700 dark:text-red-300" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={!input.trim() || verifying}
              className="min-h-11 w-full rounded-md bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 dark:disabled:bg-slate-700 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
            >
              {verifying ? '確認中...' : '開く'}
            </button>
          </form>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          このアプリは Anthropic API のコスト保護のため、招待制になっています。
        </p>
      </main>
    );
  }

  return <>{children(password, clearPassword)}</>;
}
