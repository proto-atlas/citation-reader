'use client';

import { useId, useState } from 'react';
import {
  MAX_PDF_PAGES,
  MAX_PDF_SIZE_BYTES,
  PdfTooLargeError,
  PdfTooManyPagesError,
} from '@/lib/pdf-extract';

interface Props {
  documentText: string;
  onChange: (text: string) => void;
  disabled: boolean;
}

// サンプルテキスト: エッジコンピューティングとAI推論の融合に関する技術解説。
// 要約の短縮効果を体感しやすいよう 1800 字程度で複数論点を含む構成にしている。
const SAMPLE_TEXT = `エッジコンピューティングとAI推論の融合は、2020 年代後半のアプリケーション設計における大きな潮流のひとつになっている。従来のクラウドモデルでは、ユーザーのリクエストが中央データセンターに集約され、そこで推論処理を行ってからレスポンスを返す形が一般的だった。この構造はスケールしやすい反面、ネットワーク遅延の影響を強く受け、特に対話型UIやストリーミング処理では体感レスポンスが劣化しやすい問題を抱えていた。

エッジプラットフォームの代表例であるCloudflare Workersは、V8 isolatesと呼ばれる軽量なサンドボックス機構をベースにしており、コールドスタート時間がほぼゼロで、世界 330 以上の拠点で同時にコードを実行できる。Vercel Edge FunctionsやDeno Deployも類似の方式を採り、Node.jsの一部APIを互換レイヤー越しに提供することで既存エコシステムと接続している。これによりフロントエンドに近い位置で動的なロジックを走らせる設計が現実的になった。

一方で、エッジランタイムには制約も多い。Cloudflare Workersでは 1 リクエスト当たりのCPU時間が有料プランでも最大 30 秒に制限され、圧縮後のコードサイズが 3 MiBを超えるとデプロイが拒否される。メモリも 128 MiB程度に絞られているため、重いMLモデルをWorker内に同梱して推論することは現実的ではなく、外部の推論APIを呼び出してプロキシ的に結果を整形する設計が主流となる。

AI推論をWorkersから呼ぶ場合、コスト保護が実運用上の重大な課題になる。多くのLLM APIは入出力トークン数ベースの従量課金で、一度のリクエストで数セント〜数十セントが動く。ユーザーが途中でページを閉じたり、フロント側でfetchを中断したりしても、サーバー側の推論は続行されがちで、目に見えないコストが積み上がる事故が起こり得る。これを防ぐには、クライアントのAbortSignalをサーバー側で受け取り、推論SDKのstream.abort() にブリッジする実装が欠かせない。Cloudflare WorkersではRequest.signalを通じてclient disconnectを検知でき、2025 年以降はenable_request_signal compatibility flagの明示が必要になった。

セキュリティ面では、エッジランタイムは単一ランタイム内で複数テナントのコードを同居させる構造上、メモリ隔離やI/O制限が特に厳しく設計されている。V8 isolatesは標準的なコンテナよりも起動コストが 1000 分の 1 以下で、数千のテナントが 1 プロセスに共存しても問題なく動作する。ただし、isolates境界を越えた通信は禁止されており、KV、R2、D1、Durable Objectsといった公式ストレージを通じてのみ状態を共有できる。

モニタリングと観測可能性も、エッジ固有の考慮点を持つ。従来のログ集約は中央データセンターからのtailを前提としていたが、エッジ上で動くWorkerのログは分散しており、リアルタイムで追うにはwrangler tailのような専用ツールか、Workers Analytics Engineのような集約レイヤーを経由する必要がある。これらを組み合わせ、冷温スタートのメトリクス、AbortSignalの発火率、外部APIへの依存時間などを可視化することで、エッジ + AI構成の運用を安定させることが可能になる。`;

export function DocumentInput({ documentText, onChange, disabled }: Props) {
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const textareaId = useId();
  const statusId = useId();

  async function handleFile(file: File | null) {
    if (!file) return;
    // クライアント側でsizeを先に弾く (UI早期表示のため、extractTextFromPdf内でも内部throw)
    if (file.size > MAX_PDF_SIZE_BYTES) {
      const limitMib = MAX_PDF_SIZE_BYTES / 1024 / 1024;
      setPdfStatus(`PDFが大きすぎます (上限 ${limitMib} MiB)`);
      return;
    }
    setPdfStatus(`${file.name} からテキスト抽出中...`);
    try {
      const { extractTextFromPdf } = await import('@/lib/pdf-extract');
      const text = await extractTextFromPdf(file);
      onChange(text);
      setPdfStatus(`${file.name} 読込完了 (${text.length.toLocaleString()}文字)`);
    } catch (err) {
      // 既知のドメインエラー (PdfTooLargeError / PdfTooManyPagesError) はUI向け文言として
      // 設計済なのでそのまま表示。pdfjs内部例外など想定外のErrorは生messageをUIに
      // 出さず固定文言に置換し、詳細はconsole.errorにだけ残す
      // (OWASP Improper Error Handling対応、error envelopeを
      // PDF抽出境界にも統一)。
      if (err instanceof PdfTooLargeError || err instanceof PdfTooManyPagesError) {
        setPdfStatus(`抽出失敗: ${err.message}`);
      } else {
        console.error('[DocumentInput] PDF抽出失敗:', err);
        setPdfStatus('PDFからテキストを抽出できませんでした。別のファイルをお試しください。');
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={textareaId}
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          ドキュメント
        </label>
        <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          {/* PDFアップロード: labelがfile inputをラップしてクリック対象 + キーボードフォーカス */}
          <label
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border border-slate-400 dark:border-slate-700 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-emerald-500 ${
              disabled ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            PDFをアップロード
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                // 同じファイルを連続選択したときもonChangeが発火するようにvalueをリセット
                e.target.value = '';
                void handleFile(file);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(SAMPLE_TEXT)}
            disabled={disabled}
            className="inline-flex min-h-11 items-center rounded-md border border-slate-400 dark:border-slate-700 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            サンプル読込
          </button>
        </div>
      </div>
      {pdfStatus && (
        <p id={statusId} role="status" className="text-xs text-slate-700 dark:text-slate-300">
          {pdfStatus}
        </p>
      )}
      <textarea
        id={textareaId}
        value={documentText}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="テキストを貼り付けるか、PDFをアップロードしてください。AIが要約・引用元付きで質問に回答します。"
        aria-describedby={pdfStatus ? statusId : undefined}
        className="min-h-[280px] w-full rounded-lg border border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-500 disabled:opacity-50 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
        <span>{documentText.length.toLocaleString()}文字</span>
        <span className="text-slate-600 dark:text-slate-400">
          最大200,000文字 / PDF上限{(MAX_PDF_SIZE_BYTES / 1024 / 1024).toFixed(0)}MiB・{' '}
          {MAX_PDF_PAGES}ページ
        </span>
      </div>
    </div>
  );
}
