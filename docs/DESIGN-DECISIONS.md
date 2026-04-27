# Design Decisions

このドキュメントは、citation-reader を実装するときに下した**トレードオフを伴う判断**とその理由を記録する。「なぜそう決めたか」を残すことで、将来の変更時にコンテキストを失わない。

---

## 1. エッジランタイムは Cloudflare Workers + OpenNext

**決定**: Vercel ではなく Cloudflare Workers に `@opennextjs/cloudflare` 経由でデプロイする。

**理由**:
- Free 枠 100,000 req/day で十分（デモ用途）
- `next dev` の体験は Vercel と同等だが、ランタイム分離（workerd）で V8 Isolate のコールドスタートほぼゼロ
- Cloudflare Secrets で API キーを管理できる

**トレードオフ**:
- OpenNext は Windows 公式サポート外。`npm run preview` はローカルで 500 を返す。→ ローカル検証は `next dev` のみに限定し、プレビュー検証は CI + Cloudflare Workers 本番 URL で行う運用にしている（README 記載）。
- Workers の 3 MiB（圧縮後）上限。現行実装で収まっているが、将来の依存追加時は再確認が必要。

---

## 2. モデルは `claude-haiku-4-5-20251001` に固定

**決定**: UI からのモデル選択は出さず、`src/lib/models.ts` の 1 定数に固定。

**理由**:
- Haiku 4.5 は Citations + Prompt Caching + streaming に対応する最安モデル
- 月額 Spend Limit $5〜$10 / month と合わせ、コストの上限を設計側で縛る
- 切り替えたくなったときの変更点を 1 ファイル 1 行に閉じ込める（`MODEL_ID` / `MODEL_LABEL`）

**トレードオフ**:
- 呼び出し側から見ると柔軟性が下がるが、ポートフォリオのデモとしては「コスト保護を明示的に設計した」ことが差別化ポイントになる。

---

## 3. アクセスゲートは共有秘密 + constant-time 比較

**決定**: OAuth / パスワード DB / CAPTCHA は採用せず、環境変数 `ACCESS_PASSWORD` を Bearer トークンとして使う。

**理由**:
- 招待制デモのため、「URL を知っている人だけが試す」という前提
- 会員登録フローは採用担当者の体験を阻害する
- サーバ側で `constantTimeEqual` を通すことで、単純な `===` 比較のタイミング攻撃を回避

**トレードオフ**:
- `constantTimeEqual` の現行実装は長さ違いで早期 `false` を返すため、**厳密な意味での constant-time ではない**。攻撃者は「長さが一致した」ことだけは推測できる。これは共有秘密の長さが漏れても実害が限定的なため、可読性を優先して受け入れている。コメントで明示済（`src/lib/auth.ts`）。より厳密にするなら最長長で固定ループし最後に長さ比較をまとめる実装に差し替え可能。

---

## 4. レート制限は in-memory sliding window

**決定**: Workers KV / Durable Objects / 専用 Rate Limiter binding は使わず、module-level `Map` で IP ごとの timestamp 配列を持つ。

**理由**:
- デモ規模のトラフィックではほぼ同一 isolate にヒットするため、isolate 間の分散は無視できる
- KV の書き込みレイテンシや課金を避けられる
- 関数シグネチャを `checkRateLimit(ip, now)` にして KV 版への差し替えが機械的にできるようにしてある

**トレードオフ**:
- 複数 isolate が並列起動するケースでは制限が緩くなる。**本番スケール時は `env.RATE_LIMITER.limit({ key })` binding に置き換え可能**。現状は Spend Limit による上限で実害を抑えている。

---

## 5. SSE クライアントは SDK 未経由の自前パース

**決定**: `@anthropic-ai/sdk` の stream helper をブラウザで直接使わず、サーバ側で SDK を使って SSE を中継、クライアントは `fetch` + 自前パーサ。

**理由**:
- ブラウザに API キーを露出させない（多層ゲートの前提）
- サーバ側で `MessageStream.abort()` と `req.signal` を接続することでキャンセル時のコストを即停止できる
- クライアント側は `content_block_delta` と `citations_delta` を `index` で `AnswerBlock` にマージするだけのシンプルな状態管理に収まる

**トレードオフ**:
- サーバ側で SDK のイベント名に依存する箇所が残る（SDK 更新時の差分を確認する必要）。
- `sse-client.ts` のパースは `\n\n` 境界 / `[DONE]` / 不正 JSON / チャンク境界再構築を自前で扱うが、Vitest で 7 ケースをカバーしている。

---

## 6. Citations は index ベースの UI マージ

**決定**: 回答は `AnswerBlock[]` で `index` をキーに text と citations を別々に upsert する。

**理由**:
- Anthropic の Citations は `content_block` 単位で配信され、同一ブロックに複数の `citations_delta` が流れてくる
- バッジを順序通り描画しつつ、同じ引用が複数バッジで現れても番号を一意化する必要がある
- `keyToNumber` で `document_index + start_char + cited_text` のキーから連番を引き当てる構造にして、同一引用は同じ番号を再利用している

**トレードオフ**:
- `lookupKey` は `cited_text.slice(0, 40)` を含むため、完全同一文面が近接位置にある場合は区別できない。現実のドキュメントではほぼ起きないため、実害限定として受け入れている。

---

## 7. Prompt Caching は `ephemeral` を採用

**決定**: ドキュメント本文を `cache_control: { type: 'ephemeral' }` でキャッシュする。

**理由**:
- 同じドキュメントに対する連続質問で入力トークンコストを大幅削減
- 5 分 TTL は「採用担当者がページを開いたまま複数質問する」というユースケースに合致
- `usage.cache_creation_input_tokens` / `cache_read_input_tokens` を UI に表示して、効果を可視化

**トレードオフ**:
- 頻繁にドキュメントを切り替えるユースケースではキャッシュミス率が上がる。デモ用途では許容。

---

## 8. PDF 抽出はクライアント側で実施

**決定**: PDF バイナリをサーバへ送らず、ブラウザ側で `pdfjs-dist` を動的 import して抽出する。

**理由**:
- Workers の CPU 時間制約を避ける（PDF 抽出は重い）
- 本文がサーバログに残らない設計を保てる（プライバシー）
- `pdfjs-dist` は Worker ファイルを `/public/pdf.worker.min.mjs` として同梱しており、CORS 問題を回避

**トレードオフ**:
- PDF 抽出ロジックをテストするため、`buildPageText` / `normalizeExtractedText` を pure 関数として分離 export した（pdfjs-dist は Node で動かない）。テスト容易性のための軽微な API 拡張。

---

## 9. ダークモードは class 戦略 + localStorage + FOUC 防止

**決定**: Tailwind v4 の `@custom-variant dark (&:where(.dark, .dark *))` を `globals.css` で定義し、`<html class="dark">` を JavaScript で切り替える。

**理由**:
- OS 追従（`prefers-color-scheme` のみ）だと、採用担当者の OS 設定に縛られる
- 3 択（ライト / 自動 / ダーク）にすることでデモ中のモード切替を可能にする
- ハイドレーション前に `<head>` 内 inline script で class を適用することで FOUC（白背景のチラつき）を防ぐ
- `<html suppressHydrationWarning>` で SSR と CSR の class 差異を許容

**トレードオフ**:
- inline script は `dangerouslySetInnerHTML` を使うが、固定文字列のみでユーザー入力に依存しないため XSS リスクはない。
- `ThemeToggle` はマウント前に等幅プレースホルダを描画して、レイアウトシフトも抑えている。

---

## 10. テスト戦略: Vitest ユニット優先 + Playwright はクリティカルパス

**決定**: Vitest で 39 ケース（auth / rate-limit / sse-client / pdf-extract）、Playwright は認証ゲートのみ（Chromium、3 シナリオ）。

**理由**:
- Citations ストリーミングの統合テストはモックが大きくなりコストが見合わない。ユニットで `sse-client` のパース境界を固めれば十分
- 採用デモで一番壊れて困るのは「アクセスキー入力 → メイン UI」。ここだけ実ブラウザで保証する
- カバレッジは行 60% / 関数 70% / 分岐 50% を vitest.config.ts で閾値設定

**トレードオフ**:
- Citations バッジクリック → SourceViewer のハイライトは E2E 未カバー。将来追加の余地として SPEC に記載。
