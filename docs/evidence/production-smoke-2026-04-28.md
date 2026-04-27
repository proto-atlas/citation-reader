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
- Anthropic API を呼ぶ `/api/chat` live smoke は、課金と外部 API 送信を伴うため、この証跡では未実施。
