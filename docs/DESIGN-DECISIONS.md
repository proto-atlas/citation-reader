# 設計判断

このドキュメントは、citation-readerを実装するときに下した**トレードオフを伴う判断**とその理由を記録する。「なぜそう決めたか」を残すことで、将来の変更時にコンテキストを失わない。

---

## 1. エッジランタイムはCloudflare Workers + OpenNext

**決定**: VercelではなくCloudflare Workersに `@opennextjs/cloudflare` 経由でデプロイする。

**理由**:
- Free枠 100,000 req/dayで十分（デモ用途）
- `next dev` の体験はVercelと同等だが、ランタイム分離（workerd）でV8 Isolateのコールドスタートほぼゼロ
- Cloudflare SecretsでAPIキーを管理できる

**トレードオフ**:
- OpenNextはWindows公式サポート外。`npm run preview` はローカルで 500 を返す。→ ローカル検証は `next dev` のみに限定し、プレビュー検証はCI + Cloudflare Workers本番URLで行う運用にしている（README記載）。
- Workersの 3 MiB（圧縮後）上限。現行実装で収まっているが、将来の依存追加時は再確認が必要。

---

## 2. モデルは `claude-haiku-4-5-20251001` に固定

**決定**: UIからのモデル選択は出さず、`src/lib/models.ts` の 1 定数に固定。

**理由**:
- Haiku 4.5 はCitations + Prompt Caching + streamingに対応する最安モデル
- 月額Spend Limit $5〜$10 / monthと合わせ、コストの上限を設計側で縛る
- 切り替えたくなったときの変更点を 1 ファイル 1 行に閉じ込める（`MODEL_ID` / `MODEL_LABEL`）

**トレードオフ**:
- 呼び出し側から見ると柔軟性が下がるが、公開URLでは「コスト保護を明示的に設計した」ことが差別化ポイントになる。

---

## 3. アクセス制限は共有秘密 + constant-time比較

**決定**: OAuth / パスワードDB / CAPTCHAは採用せず、環境変数 `ACCESS_PASSWORD` をBearerトークンとして使う。

**理由**:
- 招待制デモのため、「URLを知っている人だけが試す」という前提
- 会員登録フローは確認者の体験を阻害する
- サーバ側で `constantTimeEqual` を通すことで、単純な `===` 比較のタイミング攻撃を回避

**トレードオフ**:
- `constantTimeEqual` は長さが違う場合も早期returnせず、最長長まで比較したうえで長さ差分を `mismatch` に含める。Edge runtime / Workers互換性を優先し、Node.js固有の `crypto.timingSafeEqual` には依存していない。
- 共有秘密方式は本格的なユーザー認証ではない。公開URL用途ではsignup frictionを避けるため採用し、ユーザー登録を含む運用ならCloudflare Access / OAuth / Turnstile等に置き換える。

---

## 4. レート制限はCloudflare binding + edge cache補助 + メモリ上の代替処理

**決定**: 本番では `wrangler.jsonc` の `ratelimits` に定義した `RATE_LIMITER` を `checkRateLimitFromContext()` から呼び、さらにWorkers Cache APIで同一edge内のburstを補助的に抑える。binding / Cache APIが無いdev / Vitestでは `rate-limit.ts` のin-memory sliding windowに切り替える。

**理由**:
- `/api/auth` と `/api/chat` の両方をAIコスト・共有秘密総当たりから守るため、認証前/Anthropic呼び出し前に必ずrate limitを通す。
- in-memoryだけではCloudflare Workersの複数isolateで緩くなるため、本番はCloudflare Workers Rate Limiting bindingを優先する。
- 2026-04-29の本番手動burstでbinding単独では429を確認できなかったため、同一edge内の実証可能な補助防衛としてWorkers Cache APIを追加した。
- dev / unit testではCloudflare bindingが無いため、同じwrapperから決定的なin-memory実装へ切り替え、テスト容易性を維持する。

**トレードオフ**:
- Cloudflare Rate Limiting bindingとWorkers Cache API補助はabuse reduction用であり、会計グレードの強整合カウンタではない。厳密な月額上限が必要ならDurable Objects等へ置き換える。
- 1つの `RATE_LIMITER` を `/api/auth` と `/api/chat` で共有しているため、ログイン試行とAI質問が同じbucketを消費する。招待制デモでは許容し、必要ならscope別bindingに分ける。

---

## 5. SSEクライアントはSDK未経由の自前パース

**決定**: `@anthropic-ai/sdk` のstream helperをブラウザで直接使わず、サーバ側でSDKを使ってSSEを中継、クライアントは `fetch` + 自前パーサ。

**理由**:
- ブラウザにAPIキーを露出させない（多層ゲートの前提）
- サーバ側で `MessageStream.abort()` と `req.signal` を接続することでキャンセル時のコストを即停止できる
- クライアント側は `content_block_delta` と `citations_delta` を `index` で `AnswerBlock` にマージするだけのシンプルな状態管理に収まる

**トレードオフ**:
- サーバ側でSDKのイベント名に依存する箇所が残る（SDK更新時の差分を確認する必要）。
- `sse-client.ts` のパースは `\n\n` 境界 / `[DONE]` / 不正JSON / チャンク境界再構築を自前で扱うが、Vitestで 7 ケースをカバーしている。

---

## 6. CitationsはindexベースのUIマージ

**決定**: 回答は `AnswerBlock[]` で `index` をキーにtextとcitationsを別々にupsertする。

**理由**:
- AnthropicのCitationsは `content_block` 単位で配信され、同一ブロックに複数の `citations_delta` が流れてくる
- バッジを順序通り描画しつつ、同じ引用が複数バッジで現れても番号を一意化する必要がある
- `keyToNumber` で `document_index + start_char + cited_text` のキーから連番を引き当てる構造にして、同一引用は同じ番号を再利用している

**トレードオフ**:
- `lookupKey` は `cited_text.slice(0, 40)` を含むため、完全同一文面が近接位置にある場合は区別できない。現実のドキュメントではほぼ起きないため、実害限定として受け入れている。

---

## 7. Prompt Cachingは `ephemeral` を採用

**決定**: ドキュメント本文を `cache_control: { type: 'ephemeral' }` でキャッシュする。

**理由**:
- 同じドキュメントに対する連続質問で入力トークンコストを大幅削減
- 5 分TTLは「確認者がページを開いたまま複数質問する」というユースケースに合致
- `usage.cache_creation_input_tokens` / `cache_read_input_tokens` をUIに表示して、効果を可視化

**トレードオフ**:
- 頻繁にドキュメントを切り替えるユースケースではキャッシュミス率が上がる。デモ用途では許容。

---

## 8. PDF抽出はクライアント側で実施

**決定**: PDFバイナリをサーバへ送らず、ブラウザ側で `pdfjs-dist` を動的importして抽出する。

**理由**:
- WorkersのCPU時間制約を避ける（PDF抽出は重い）
- 本文がサーバログに残らない設計を保てる（プライバシー）
- `pdfjs-dist` はWorkerファイルを `/public/pdf.worker.min.mjs` として同梱しており、CORS問題を回避

**トレードオフ**:
- PDF抽出ロジックをテストするため、`buildPageText` / `normalizeExtractedText` をpure関数として分離exportした（pdfjs-distはNodeで動かない）。テスト容易性のための軽微なAPI拡張。

---

## 9. ダークモードはclass戦略 + localStorage + FOUC防止

**決定**: Tailwind v4 の `@custom-variant dark (&:where(.dark, .dark *))` を `globals.css` で定義し、`<html class="dark">` をJavaScriptで切り替える。

**理由**:
- OS追従（`prefers-color-scheme` のみ）だと、閲覧者のOS設定に縛られる
- 3 択（ライト / 自動 / ダーク）にすることでデモ中のモード切替を可能にする
- ハイドレーション前に `<head>` 内inline scriptでclassを適用することでFOUC（白背景のチラつき）を防ぐ
- `<html suppressHydrationWarning>` でSSRとCSRのclass差異を許容

**トレードオフ**:
- inline scriptは `dangerouslySetInnerHTML` を使うが、固定文字列のみでユーザー入力に依存しないためXSSリスクはない。
- `ThemeToggle` はマウント前に等幅プレースホルダを描画して、レイアウトシフトも抑えている。

---

## 10. テスト戦略: Vitestユニット優先 + Playwrightはクリティカルパス

**決定**: Vitestで 149 ケース、Playwrightは認証画面 / SSE応答置き換え / 引用クリック / 429表示を5ブラウザmatrixで検証する。

**理由**:
- Citationsストリーミングは実AnthropicをCIで呼ばず、SSEをE2Eで置き換えてUIの引用バッジ・原文ハイライトを確認する
- 公開URLで一番壊れて困る「アクセスキー入力 → メインUI」と「回答 + 引用の視認」を実ブラウザで確認する
- カバレッジは行 60% / 関数 70% / 分岐 50% をvitest.config.tsで閾値設定

**トレードオフ**:
- Anthropic実API呼び出しはCIでは実行しない。課金と外部API依存を避けるため、`eval/runner.mjs --live --limit=1` を明示実行し、証跡だけ `docs/evidence` に保存する。
