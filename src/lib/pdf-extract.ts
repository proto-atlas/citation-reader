/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Importing dynamically prevents SSR crashes (pdfjs uses browser APIs).
 */

/** pdfjs の TextItem から拾う最小限の形。テスト容易化のため narrow な型で受ける。 */
export interface PdfTextItemLike {
  str?: string;
  hasEOL?: boolean;
}

/**
 * 1 ページ分の TextItem 群を 1 文字列に結合する。
 * 区切りを " " にすると日本語PDFのルビや文字単位分割で余計な空白が入り
 * 「令 れ い 和 わ」のように崩れるため、連結はセパレータ無しで行う。
 * 行末は hasEOL で判定して改行を入れる（英語PDFの単語間空白は item.str 側に含まれている）。
 */
export function buildPageText(items: readonly PdfTextItemLike[]): string {
  let text = '';
  for (const item of items) {
    if (item.str === undefined) continue;
    text += item.str;
    if (item.hasEOL) text += '\n';
  }
  return text;
}

/**
 * 複数ページのテキストを結合して正規化する。
 * - ページ区切りは空行 1 つ（\n\n）
 * - 連続する半角スペース / タブは 1 スペースに圧縮
 * - 行頭の空白は削除
 * - 空行 3 つ以上は 2 つに圧縮
 * - 前後の空白をトリム
 */
export function normalizeExtractedText(pageTexts: readonly string[]): string {
  return pageTexts
    .join('\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// PDFファイルサイズ・ページ数を事前制限する:
// Anthropic 入力上限 (200,000 文字) と OpenNext / Workers のメモリ (128 MiB) を踏まえ
// 過大な PDF をクライアント側で先に弾く。UI で表示する閾値とこの定数で同期する。
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_PDF_PAGES = 50;

export class PdfTooLargeError extends Error {
  constructor(public readonly limitMib: number) {
    super(`PDF が大きすぎます (上限 ${limitMib} MiB)`);
    this.name = 'PdfTooLargeError';
  }
}

export class PdfTooManyPagesError extends Error {
  constructor(
    public readonly pages: number,
    public readonly limit: number,
  ) {
    super(`PDF のページ数が多すぎます (${pages} ページ、上限 ${limit} ページ)`);
    this.name = 'PdfTooManyPagesError';
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction must run in the browser');
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new PdfTooLargeError(MAX_PDF_SIZE_BYTES / 1024 / 1024);
  }

  const pdfjs = await import('pdfjs-dist');

  // Worker is served from /public so the version always matches the npm install.
  // We load the worker from the same origin to avoid CORS issues in dev/preview.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new PdfTooManyPagesError(pdf.numPages, MAX_PDF_PAGES);
  }

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    pageTexts.push(buildPageText(textContent.items as PdfTextItemLike[]));
  }

  return normalizeExtractedText(pageTexts);
}
