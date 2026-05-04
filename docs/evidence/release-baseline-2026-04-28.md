# Release Baseline

Date: 2026-04-28

## Purpose

Record the verified project state before the next release-quality improvement pass.

## Repository

- Project: `citation-reader`
- Branch: `main`
- HEAD: `c4ffaafdadc4020958300d91b5a8870e94e5c74b`
- Last commit: `c4ffaaf Lighthouse本番計測の証跡を追加`
- Working tree at verification time: clean
- Remote `main`: `c4ffaafdadc4020958300d91b5a8870e94e5c74b`

## Public URL

- URL: `https://citation-reader.atlas-lab.workers.dev`
- Method: `HEAD`
- Status: `200`
- Server: `cloudflare`

## GitHub Actions

- Repository: `proto-atlas/citation-reader`
- Latest workflow: `CI`
- Run ID: `25050114372`
- Status: `completed`
- Conclusion: `success`
- Created at: `2026-04-28T11:26:58Z`
- Head SHA: `c4ffaafdadc4020958300d91b5a8870e94e5c74b`
- URL: `https://github.com/proto-atlas/citation-reader/actions/runs/25050114372`

## Local Verification

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | pass | `tsc --noEmit`, exit 0 |
| `npm run lint` | pass | ESLint and Prettier check passed |
| `npm run test` | pass | 11 files / 134 tests passed |
| `npm run test:coverage` | pass | 11 files / 134 tests passed |
| `npm run build` | pass | Next.js 16.2.4 webpack build succeeded |
| `git diff --check` | pass | no whitespace errors |

Coverage summary:

| Metric | Value |
|---|---:|
| Statements | 80.14% |
| Branches | 78.43% |
| Functions | 81.25% |
| Lines | 82.20% |

Build routes:

- `/`
- `/_not-found`
- `/api/auth`
- `/api/chat`
- `/icon.svg`

## Environment Notes

Sandboxed Vitest and Next.js build execution failed with `spawn EPERM`.
The same commands were rerun with normal execution permissions and passed.
This is recorded as an execution environment constraint, not as a project failure.

## Conclusion

The project is clean and deployable at HEAD `c4ffaafdadc4020958300d91b5a8870e94e5c74b`.
