# 公開URL確認記録

生成日時: 2026-04-29

## 対象

- Project: `citation-reader`
- 確認対象のapplication code commit: `47080dfaeb9a6f076b78a09b84b400fdf637f4ce`
- 記録更新commit: `11510fa35c4381c0840b520f6db3f263715774c9`
- 公開URL: `https://citation-reader.atlas-lab.workers.dev`
- 確認種別: production静的route確認
- 結果: 通過

この確認ではlive APIを呼び出しません。
evidence更新commitの差分は `docs/evidence/*` のみ。application/runtime codeは上記の確認対象commitから変わっていない。

## 確認項目

| 確認項目 | 結果 | 補足 |
|---|---|---|
| `HEAD /` | 通過 | HTTP 200 |
| Content-Type | 通過 | `text/html; charset=utf-8` |
| Server | 通過 | `cloudflare` |
| browser描画後のアクセス入力 | 通過 | アクセスキー入力フォームを確認 |
| Browser title | 通過 | `citation-reader: 引用元付きAI要約・Q&A` |

## コマンド

```text
Invoke-WebRequest -Uri 'https://citation-reader.atlas-lab.workers.dev' -Method Head
node -e "<Playwright Chromium check>"
```

## 補足

- access gateはclient-renderedなので、raw HTML bodyにはhydration後のUI文字列がすべて含まれるわけではありません。
- browser描画後の確認で、hydration後のアクセスキー入力フォームを確認しました。
- アクセスキーは使用していません。
- 実API `/api/chat` requestは送信していません。
- この証跡にはsecret値、アクセスキー、cookie、API keyを記録していません。
- 確認対象のapplication code commitからevidence更新commitまでの差分は、次の範囲に限る:
  - `docs/evidence/deployment-2026-04-29.md`
  - `docs/evidence/production-check-2026-04-29.md`
