// @vitest-environment happy-dom
// theme.tsはDOM (document / window / localStorage) を触る純関数群。
// node環境ではwindow不在のためテストできず、happy-dom環境で実行する。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_KEY,
  applyTheme,
  getStoredTheme,
  resolveTheme,
  storeTheme,
  type Theme,
} from './theme';

describe('THEME_KEY', () => {
  it('citation-reader名前空間で固定されている (他プロジェクトとの取り違え防止)', () => {
    expect(THEME_KEY).toBe('citation-reader.theme');
  });
});

describe('resolveTheme', () => {
  let matchMediaSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    matchMediaSpy = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaSpy,
    });
  });

  it('lightをそのまま返す (system解決を経由しない)', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(matchMediaSpy).not.toHaveBeenCalled();
  });

  it('darkをそのまま返す', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(matchMediaSpy).not.toHaveBeenCalled();
  });

  it('system + matchMedia.matches=trueでdarkを返す (OS追従)', () => {
    matchMediaSpy.mockReturnValue({ matches: true });
    expect(resolveTheme('system')).toBe('dark');
    expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('system + matchMedia.matches=falseでlightを返す', () => {
    matchMediaSpy.mockReturnValue({ matches: false });
    expect(resolveTheme('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('darkで <html> にdarkクラスを付与する', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('lightで <html> からdarkクラスを除去する', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('既にdarkならdarkで再付与してもduplicateしない', () => {
    document.documentElement.classList.add('dark');
    applyTheme('dark');
    expect(
      document.documentElement.className.split(/\s+/).filter((c) => c === 'dark'),
    ).toHaveLength(1);
  });
});

describe('getStoredTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('localStorageが空ならsystemを返す', () => {
    expect(getStoredTheme()).toBe('system');
  });

  it('localStorageに "light" があればlightを返す', () => {
    window.localStorage.setItem(THEME_KEY, 'light');
    expect(getStoredTheme()).toBe('light');
  });

  it('localStorageに "dark" があればdarkを返す', () => {
    window.localStorage.setItem(THEME_KEY, 'dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('localStorageに "system" があればsystemを返す', () => {
    window.localStorage.setItem(THEME_KEY, 'system');
    expect(getStoredTheme()).toBe('system');
  });

  it('予期しない値 (例: "blue") はsystemにフォールバックする', () => {
    window.localStorage.setItem(THEME_KEY, 'blue');
    expect(getStoredTheme()).toBe('system');
  });

  it('localStorageが例外を投げる場合 (private browsing等) はsystemにフォールバック', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getStoredTheme()).toBe('system');
    spy.mockRestore();
  });
});

describe('storeTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('localStorageにテーマを保存する', () => {
    storeTheme('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('保存後にgetStoredThemeで同じ値を取り出せる (round-trip)', () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    for (const t of themes) {
      storeTheme(t);
      expect(getStoredTheme()).toBe(t);
    }
  });

  it('localStorageが例外を投げても致命傷にならない (private browsing等)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storeTheme('dark')).not.toThrow();
    spy.mockRestore();
  });
});
