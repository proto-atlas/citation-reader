# Release Baseline

Date: 2026-04-29

## Purpose

Record the verified release state for the public demo as a point-in-time evidence snapshot. This file does not claim to match the latest repository HEAD.

## Repository

- Project: `citation-reader`
- Branch: `main`
- Verification scope: source, tests, public evidence, GitHub Actions, and deployed URL
- Commit reference: use the GitHub commit view and Actions run for the exact source revision.
- Note: fixed self-referential HEAD values are not embedded in this file because documentation-only evidence commits can legitimately update the public repository after code verification.

## Public URL

- URL: `https://citation-reader.atlas-lab.workers.dev`
- Method: `HEAD`
- Status: `200`
- Server: `cloudflare`

## Local Verification

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | pass | ESLint and Prettier check passed |
| `npm run typecheck` | pass | `tsc --noEmit`, exit 0 |
| `npm run test:coverage` | pass | 12 files / 142 tests passed |
| `npm run build` | pass | Next.js 16.2.4 webpack build succeeded |
| `npm run e2e -- --project=chromium --workers=1` | pass | 8 / 8 Playwright tests passed |
| `npm audit --audit-level=high` | pass | high / critical: 0, moderate: 6 |
| `git diff --check` | pass | no whitespace errors |

Coverage summary:

| Metric | Value |
|---|---:|
| Statements | 82.80% |
| Branches | 82.19% |
| Functions | 86.36% |
| Lines | 85.04% |

## Production Evidence

- `/api/chat` live eval: `eval-result-2026-04-28.json`, status 200, citation 1, errors 0
- mock eval path check: `eval-result-2026-04-29.json`, mode `mock`, 3 fixtures loaded without external AI API calls
- `/api/chat` live smoke summary: `live-ai-smoke-2026-04-28.md`
- Abuse protection: `abuse-protection-2026-04-28.md`
- Production static smoke: `production-smoke-2026-04-29.md`
- Deployment evidence: `deployment-2026-04-29.md`
- Post-deploy rate limit burst snapshot: `production-smoke-2026-04-28.md`
- Dependency audit: `dependency-audit-2026-04-28.md`
- License inventory: `license-inventory-2026-04-29.json`

## Environment Notes

Sandboxed Vitest, Next.js build, and Playwright execution failed with `spawn EPERM`.
The same commands were rerun with normal execution permissions and passed.
This is recorded as an execution environment constraint, not as a project failure.

Local full-browser Playwright execution was not used as release evidence because Firefox / WebKit / mobile-safari browser binaries were not installed in this Windows environment.
The GitHub Actions E2E matrix is the release source for cross-browser confirmation.

## Conclusion

The verified code commit is deployable and has production evidence for live AI behavior, abuse protection, dependency status, and public smoke checks.
