# 確認ガイド

## 30秒で見る

- 公開URL: https://citation-reader.atlas-lab.workers.dev
- キーなしで確認できる範囲: スクリーンショットと検証記録。引用UIの見た目は外部AI APIを呼ばずに確認できる
- GitHub: https://github.com/proto-atlas/citation-reader

## 5分で見る

- READMEの機能一覧とアクセスキー制の理由を読む
- 検証記録の対応表を見る: [docs/evidence/INDEX.md](./evidence/INDEX.md)
- チャットAPIの境界を見る: `src/app/api/chat/route.ts`
- 引用UIの動きを見る: `src/components/AnswerView.tsx`
- 設計判断を見る: [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)

## 技術的な見どころ

- Anthropic Citations APIのstreaming eventを、アプリ側のSSE eventに正規化して表示している。
- 引用バッジと原文ハイライトを分け、回答本文と引用元の対応を画面上で追える。
- PDFはブラウザ側で `pdfjs-dist` により抽出し、PDF binaryをサーバーへ送らない。
- 実APIのQ&Aは、アクセスキー、短期session cookie、レート制限、Anthropic Spend Limitを重ねてコストを保護している。
- LLM評価は短い架空fixtureに限定し、引用件数、重複、Markdown混入などを検証記録として残している。

## 公開範囲とキー保護範囲

| 項目 | アクセスキー | 補足 |
|---|---:|---|
| スクリーンショット | 不要 | 固定fixtureから生成 |
| READMEと検証記録 | 不要 | 公開文書と特定時点の検証記録 |
| 実APIのQ&A | 必要 | 課金と乱用を抑えるためアクセスキーで保護 |
| 実API評価 | 手動 | 短い架空fixtureのみ。通常CIには含めない |

## 検証記録の扱い

`docs/evidence/` のファイルは特定時点の記録です。最新HEADと一致することは主張しません。再確認するときは、対象commitとCI runを別途指定します。

検証記録には、secret、アクセスキー、cookie、APIキー、ローカルファイルパスなど公開しない情報を除外し、確認日時・確認対象・確認手順・結果を公開文書に記録しています。

## 通常は実施しないこと

- 認証情報の総当たり
- 負荷試験
- 明示判断なしの実API呼び出し
- 非公開文書や実ユーザー文書の投入
- 少ないリクエストで閾値に届かない本番レート制限の連続確認
