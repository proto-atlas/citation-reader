# デプロイ検証記録

日付: 2026-04-28

## デプロイ

- コマンド: `npm run deploy`
- 対象: Cloudflare Workers
- URL: `https://citation-reader.atlas-lab.workers.dev`
- 結果: 成功

## build結果

デプロイコマンドは完了しました。

- `next build --webpack`: 成功
- `opennextjs-cloudflare build --skipNextBuild`: 成功
- `opennextjs-cloudflare deploy`: 成功

デプロイされたroute:

- `/`
- `/_not-found`
- `/api/auth`
- `/api/chat`
- `/icon.svg`

deploy中に報告されたCloudflare bindings:

- `WORKER_SELF_REFERENCE`
- `RATE_LIMITER` (`10 requests/60s`)
- `ASSETS`

最新のredeploy:

- 日付: 2026-04-29
- Current Version ID: `3eba6401-314c-4a39-8e42-95bc2459f4ae`
- 理由: 最終版の公開検証記録と、rate limiting用のWorkers Cache API補助を反映するため。
- binding出力で `RATE_LIMITER (10 requests/60s)` を再確認。

## デプロイ後の公開URL確認

確認日時: `2026-04-28T14:46:36.0148579Z`

| 確認項目 | 結果 |
|---|---|
| `GET /` | `200` |
| `GET /` content-type | `text/html; charset=utf-8` |
| `POST /api/auth` | `200` |
| `POST /api/auth` content-type | `application/json` |
| `POST /api/auth` Set-Cookie | present |

2026-04-28T21:28:10.9387414Zの最終デプロイ後確認:

| 確認項目 | 結果 |
|---|---|
| `HEAD /` | `200` |
| `POST /api/auth` with valid `Authorization` header | `200` |
| `POST /api/auth` Set-Cookie | present |
| `/api/auth` wrong-key burst | `1:401, 2:401, 3:401, 4:401, 5:401, 6:401, 7:401, 8:401, 9:401, 10:401, 11:429, 12:429` |

## 補足

- `ACCESS_PASSWORD` はローカル環境ファイルから読み込み、出力やこの検証記録への書き込みはしていません。
- commit `e361639d3f296be61cc92d1ed50e371f238d6369` のGitHub Actions run `25059656096` は、この記録更新時点ではqueuedでした。
- GitHub repository secretsによるCloudflare自動deployは意図的に設定していないため、手動deployを使いました。
- Cloudflare Version IDはデプロイコマンドが出力し、文書だけの再デプロイでも変わります。安定した公開確認対象はURLと上記のデプロイ後確認結果です。
