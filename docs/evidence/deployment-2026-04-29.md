# デプロイ検証記録

生成日: 2026-04-29

## 対象

- Project: `citation-reader`
- デプロイしたapplication code commit: `47080dfaeb9a6f076b78a09b84b400fdf637f4ce`
- 記録更新commit: `11510fa35c4381c0840b520f6db3f263715774c9`
- 公開URL: `https://citation-reader.atlas-lab.workers.dev`
- 確認種別: Cloudflare Workers deploy
- 結果: 通過

このファイルは特定時点のデプロイ記録です。検証記録の更新commitは `docs/evidence/*` だけを変更しており、アプリケーション実行時のコードは上記のデプロイ対象commitから変わっていません。

## コマンド

```text
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

## 結果

| 項目 | 値 |
|---|---|
| Worker | `citation-reader` |
| URL | `https://citation-reader.atlas-lab.workers.dev` |
| Version ID | `066eebda-5d4d-4444-b2e4-59c720af0a44` |
| Worker Startup Time | `30 ms` |
| Uploaded assets | `1 file (26 already uploaded)` |
| Total upload | `5363.53 KiB / gzip: 1114.25 KiB` |

## Wranglerが報告したbindings

| binding | resource |
|---|---|
| `WORKER_SELF_REFERENCE` | Worker `citation-reader` |
| `RATE_LIMITER` | Rate Limit, `10 requests/60s` |
| `ASSETS` | Assets |

## 補足

- OpenNextはWindows互換性warningを出しましたが、buildとdeployは完了しました。
- Nodeはtoolchain内部のchild-process shell invocationから `DEP0190` を出しましたが、deployは完了しました。
- この検証記録にはsecret値、アクセスキー、cookie、API keyを含めていません。
- デプロイ済みアプリケーションcode commitから、この検証記録更新commitまでの差分は次に限定されます。
  - `docs/evidence/deployment-2026-04-29.md`
  - `docs/evidence/production-check-2026-04-29.md`
