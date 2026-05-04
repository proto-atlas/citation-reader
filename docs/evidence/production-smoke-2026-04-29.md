# Production Smoke Evidence

Generated at: 2026-04-29

## Scope

- Project: `citation-reader`
- Application code commit checked: `47080dfaeb9a6f076b78a09b84b400fdf637f4ce`
- Evidence update commit: `11510fa35c4381c0840b520f6db3f263715774c9`
- Public URL: `https://citation-reader.atlas-lab.workers.dev`
- Check type: production static smoke
- Result: pass

This smoke does not call the live AI API.
The evidence update commit only changes `docs/evidence/*`; application/runtime code is unchanged from the application code commit checked above.

## Checks

| Check | Result | Notes |
|---|---|---|
| `HEAD /` | pass | HTTP 200 |
| Content-Type | pass | `text/html; charset=utf-8` |
| Server | pass | `cloudflare` |
| Browser-rendered access gate | pass | Access-key form visible |
| Browser title | pass | `citation-reader — 引用元付き AI 要約・Q&A` |

## Commands

```text
Invoke-WebRequest -Uri 'https://citation-reader.atlas-lab.workers.dev' -Method Head
node -e "<Playwright Chromium smoke>"
```

## Notes

- The access gate is client-rendered, so the raw HTML body does not include every hydrated UI string.
- The browser-rendered smoke confirmed the access-key form after hydration.
- No access key was used.
- No live `/api/chat` request was sent.
- No secret values, access keys, cookies, or API keys are recorded in this evidence.
- Diff from the application code commit checked to the evidence update commit is limited to:
  - `docs/evidence/deployment-2026-04-29.md`
  - `docs/evidence/production-smoke-2026-04-29.md`
