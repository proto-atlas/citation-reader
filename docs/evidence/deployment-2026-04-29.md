# Deployment Evidence

Generated at: 2026-04-29

## Scope

- Project: `citation-reader`
- Application code commit deployed: `47080dfaeb9a6f076b78a09b84b400fdf637f4ce`
- Evidence update commit: `11510fa35c4381c0840b520f6db3f263715774c9`
- Public URL: `https://citation-reader.atlas-lab.workers.dev`
- Check type: Cloudflare Workers deploy
- Result: pass

This file is a point-in-time deployment log. The evidence update commit only changes `docs/evidence/*`; application/runtime code is unchanged from the deployed application code commit above.

## Command

```text
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

## Result

| Item | Value |
|---|---|
| Worker | `citation-reader` |
| URL | `https://citation-reader.atlas-lab.workers.dev` |
| Version ID | `066eebda-5d4d-4444-b2e4-59c720af0a44` |
| Worker Startup Time | `30 ms` |
| Uploaded assets | `1 file (26 already uploaded)` |
| Total upload | `5363.53 KiB / gzip: 1114.25 KiB` |

## Bindings Reported by Wrangler

| Binding | Resource |
|---|---|
| `WORKER_SELF_REFERENCE` | Worker `citation-reader` |
| `RATE_LIMITER` | Rate Limit, `10 requests/60s` |
| `ASSETS` | Assets |

## Notes

- OpenNext emitted a Windows compatibility warning. Build and deploy still completed.
- Node emitted `DEP0190` from a child-process shell invocation inside the toolchain. Deploy still completed.
- No secret values, access keys, cookies, or API keys are recorded in this evidence.
- Diff from the deployed application code commit to the evidence update commit is limited to:
  - `docs/evidence/deployment-2026-04-29.md`
  - `docs/evidence/production-smoke-2026-04-29.md`
