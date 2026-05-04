# Deployment Evidence

Date: 2026-04-28

## Deployment

- Command: `npm run deploy`
- Target: Cloudflare Workers
- URL: `https://citation-reader.atlas-lab.workers.dev`
- Result: success

## Build

The deploy command completed:

- `next build --webpack`: pass
- `opennextjs-cloudflare build --skipNextBuild`: pass
- `opennextjs-cloudflare deploy`: pass

Deployed routes:

- `/`
- `/_not-found`
- `/api/auth`
- `/api/chat`
- `/icon.svg`

Cloudflare bindings reported during deploy:

- `WORKER_SELF_REFERENCE`
- `RATE_LIMITER` (`10 requests/60s`)
- `ASSETS`

Latest redeploy:

- Date: 2026-04-29
- Current Version ID: `3eba6401-314c-4a39-8e42-95bc2459f4ae`
- Reason: deploy the final public evidence and Workers Cache API assist for rate limiting.
- Binding output again confirmed `RATE_LIMITER (10 requests/60s)`.

## Post-deploy Smoke

Checked at: `2026-04-28T14:46:36.0148579Z`

| Check | Result |
|---|---|
| `GET /` | `200` |
| `GET /` content-type | `text/html; charset=utf-8` |
| `POST /api/auth` | `200` |
| `POST /api/auth` content-type | `application/json` |
| `POST /api/auth` Set-Cookie | present |

Final post-deploy checks on 2026-04-28T21:28:10.9387414Z:

| Check | Result |
|---|---|
| `HEAD /` | `200` |
| `POST /api/auth` with valid `Authorization` header | `200` |
| `POST /api/auth` Set-Cookie | present |
| `/api/auth` wrong-key burst | `1:401, 2:401, 3:401, 4:401, 5:401, 6:401, 7:401, 8:401, 9:401, 10:401, 11:429, 12:429` |

## Notes

- `ACCESS_PASSWORD` was read from a local environment file and was not printed or written to this evidence.
- GitHub Actions run `25059656096` for commit `e361639d3f296be61cc92d1ed50e371f238d6369` was still queued at the time of this evidence update.
- Manual deploy was used because GitHub repository secrets for automatic Cloudflare deploy are intentionally not configured.
- Cloudflare Version IDs are emitted by the deploy command and can change with subsequent documentation-only redeploys; the stable public verification target is the URL and post-deploy smoke result above.
