// サーバから返される ChatErrorCode をユーザー向け日本語に変換するマップ。
// 採用担当者を含むユーザーが見ても自然で、内部実装の詳細を漏らさない文言に統一する。
//
// 注: SDK や内部例外の生 message は UI に出さない方針
// "raw upstream errors reach UI" / OWASP Improper Error Handling 対応)。
import type { ChatErrorCode } from './types';

export const ERROR_LABELS: Record<ChatErrorCode, string> = {
  unauthorized: 'アクセスキーが正しくありません。',
  rate_limit: '短時間に多くのリクエストがありました。しばらく時間を置いてから再度お試しください。',
  invalid_input: '入力内容に問題があります。フォームをご確認ください。',
  document_too_long: 'ドキュメントが長すぎます。20 万文字以内に収めてください。',
  question_too_long: '質問が長すぎます。1,000 文字以内に収めてください。',
  upstream_unavailable: 'AI サービスとの通信に失敗しました。時間を置いて再度お試しください。',
  server_misconfigured: 'サーバー設定エラーが発生しました。デモ管理者にお問い合わせください。',
  aborted: 'リクエストがキャンセルされました。',
  unknown: '予期しないエラーが発生しました。',
};

export function labelFor(code: ChatErrorCode): string {
  return ERROR_LABELS[code] ?? ERROR_LABELS.unknown;
}
