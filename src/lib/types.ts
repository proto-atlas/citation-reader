export interface ChatRequest {
  documentText: string;
  question?: string;
}

export interface CitationLocation {
  type: 'char_location' | 'page_location' | 'content_block_location';
  cited_text: string;
  document_index: number;
  document_title?: string | null;
  start_char_index?: number;
  end_char_index?: number;
  start_page_number?: number;
  end_page_number?: number;
  start_block_index?: number;
  end_block_index?: number;
}

export interface ChatTextDelta {
  type: 'text';
  text: string;
  index: number;
}

export interface ChatCitationDelta {
  type: 'citation';
  citation: CitationLocation;
  index: number;
}

/**
 * クライアント / サーバー共通のエラーコード。
 * UI に出す文言は src/lib/error-labels.ts の ERROR_LABELS で日本語に変換する。
 *
 * raw upstream errors を UI に出さない / OWASP Improper Error Handling
 * への対応として、SDK や内部処理の生エラーを UI に出さない方針。code のみを SSE / JSON で
 * 返却し、サーバ内では console.error で詳細を残す。
 */
export type ChatErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'invalid_input'
  | 'document_too_long'
  | 'question_too_long'
  | 'upstream_unavailable'
  | 'server_misconfigured'
  | 'aborted'
  | 'unknown';

export interface ChatErrorDelta {
  type: 'error';
  code: ChatErrorCode;
}

/**
 * 非 streaming エンドポイント (/api/auth, JSON 系) の標準エラー形式。
 */
export interface ApiErrorResponse {
  error: ChatErrorCode;
  retryAfterSeconds?: number;
}

export interface ChatMetaDelta {
  type: 'meta';
  model: string;
}

export interface ChatDoneDelta {
  type: 'done';
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export type ChatStreamEvent =
  | ChatTextDelta
  | ChatCitationDelta
  | ChatErrorDelta
  | ChatMetaDelta
  | ChatDoneDelta;
