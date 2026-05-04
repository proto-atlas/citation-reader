# Production Smoke 2026-04-28

対象 URL: https://citation-reader.atlas-lab.workers.dev

実行時刻: 2026-04-28T01:05:50.6362992Z

確認内容:

- `GET /`: 200
- `GET /` content-type: `text/html; charset=utf-8`
- `POST /api/auth`: 200
- `POST /api/auth` content-type: `application/json`
- `POST /api/auth` Set-Cookie: present

注記:

- `ACCESS_PASSWORD` はローカル `.env.local` から読み取ったが、値は出力・保存していない。
- Anthropic API を呼ぶ `/api/chat` live smoke は、課金と外部 API 送信を伴うため、この初回smokeでは未実施。

追記:

- その後、短い架空fixtureを使った `/api/chat` live smoke を `live-ai-smoke-2026-04-28.md` と `eval-result-2026-04-28.json` に記録した。
- 2026-04-29 に Rate Limiting 補助実装のデプロイ後、Anthropic APIを呼ばない誤認証POSTで `/api/auth` を12回送信し、11回目と12回目で429を確認した。
  - 実測: `1:401, 2:401, 3:401, 4:401, 5:401, 6:401, 7:401, 8:401, 9:401, 10:401, 11:429, 12:429`
  - 本検証は本番rate-limit bucketを一時的に消費するため、再実行時は60秒以上空ける。
- 最終deploy後、`HEAD /` は200。正しい `Authorization` header付きの `POST /api/auth` は200で、`Set-Cookie` が発行された。secret値は出力・保存していない。
