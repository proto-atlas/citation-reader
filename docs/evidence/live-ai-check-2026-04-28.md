# 実API確認

日付: 2026-04-28

## 確認内容

この確認では、短い架空fixtureを使って本番 `/api/chat` 経路を確認しました。

## 対象API

- URL: `https://citation-reader.atlas-lab.workers.dev/api/chat`
- Mode: `live`
- Sample: `ja-edge-summary`
- Limit: `1`
- 結果ファイル: [`eval-result-2026-04-28.json`](./eval-result-2026-04-28.json)

## 結果

- 通過: `true`
- HTTP status: `200`
- Content-Type: `text/event-stream; charset=utf-8`
- Model: `claude-haiku-4-5-20251001`
- Citation count: `1`
- SSE event count: `7`
- Errors: `[]`

使用量:

| Metric | Tokens |
|---|---:|
| input_tokens | 1027 |
| output_tokens | 129 |
| cache_creation_input_tokens | 0 |
| cache_read_input_tokens | 0 |

## 回答要約

モデルは日本語で回答し、架空fixtureをエッジコンピューティングとAI推論の動向として要約しました。あわせて、Cloudflare WorkersのCPU / memory制約と、重いMLモデルをWorkerへ同梱することが現実的ではない理由にも触れています。

## 引用確認

回答には、`User Document` 由来の `char_location` citationが1件含まれていました。
引用された本文は、`eval/sample-cases.json` の短い架空fixtureに含まれる内容です。

## secretの扱い

- `ACCESS_KEY` はローカルの環境ファイルから読み取り、環境変数として渡しました。
- `ACCESS_KEY` はstdoutへ出力していません。
- `ACCESS_KEY` と `ANTHROPIC_API_KEY` はJSONの検証記録へ書き込んでいません。
- 入力fixtureは架空データで、公開用の検証記録に含められる内容です。

## 結論

本番 `/api/chat` 経路で、Anthropicを使った引用付き回答を1件実行し、公開用にサニタイズした記録を残しました。
