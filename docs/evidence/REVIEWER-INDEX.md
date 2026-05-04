# Reviewer Evidence Index

## Scope

- Project: `citation-reader`
- Public URL: https://citation-reader.atlas-lab.workers.dev
- Source: https://github.com/proto-atlas/citation-reader
- Evidence files are point-in-time logs, not a claim of latest HEAD.
- For third-party review, the reviewed commit and CI run should be specified externally.

## Evidence Map

| Claim | Evidence | Generated commit | Result |
|---|---|---:|---|
| Release verification covers lint, typecheck, coverage, build, E2E, publish scan, audit, and production evidence | [release-baseline-2026-04-29.md](./release-baseline-2026-04-29.md) | See file | pass snapshot |
| Live AI smoke uses short fictional fixtures and does not record secrets | [live-ai-smoke-2026-04-28.md](./live-ai-smoke-2026-04-28.md) / [eval-result-2026-04-28.json](./eval-result-2026-04-28.json) | See file | pass snapshot |
| Citation quality evidence is recorded separately from end-user UI | [citation-quality-2026-04-29.md](./citation-quality-2026-04-29.md) | See file | accepted/drop stats are unit-tested and wired into eval utilities |
| Anthropic SDK stream handling is isolated from the route body | [sdk-boundary-2026-04-29.md](./sdk-boundary-2026-04-29.md) | See file | route has no `no-unsafe` lint suppression after adapter split |
| Access control, rate limiting, and cost guard are documented | [abuse-protection-2026-04-28.md](./abuse-protection-2026-04-28.md) | See file | documented controls and constraints |
| Production smoke and deploy evidence exist | [production-smoke-2026-04-29.md](./production-smoke-2026-04-29.md) / [deployment-2026-04-29.md](./deployment-2026-04-29.md) | See file | pass snapshot |
| Lighthouse desktop and mobile scores were recorded | [lighthouse-2026-04-28.md](./lighthouse-2026-04-28.md) / [mobile-performance-analysis-2026-04-28.md](./mobile-performance-analysis-2026-04-28.md) | See file | desktop 99/95/100/100, mobile 89/95/100/100 |
| axe-core checks were recorded | [axe-core-2026-04-29.json](./axe-core-2026-04-29.json) | See file | critical/serious 0 |
| High and critical dependency advisories are blocked; moderate advisories are mapped | [dependency-audit-2026-04-28.md](./dependency-audit-2026-04-28.md) / [dependency-advisory-map-2026-04-29.md](./dependency-advisory-map-2026-04-29.md) | See file | 0 high / 0 critical; 6 moderate documented |
| License inventory was generated locally | [license-inventory-2026-04-29.json](./license-inventory-2026-04-29.json) | See file | package license snapshot |

## Public / Key-Gated

| Area | Key required | Notes |
|---|---:|---|
| Screenshots | No | Static visual evidence. |
| README / evidence | No | Public documentation and point-in-time verification logs. |
| `/api/auth` | No | Required before live Q&A. Wrong keys are rate-limited. |
| `/api/chat` live Q&A | Yes | Access-key gated and rate-limited. |
| Live eval | Manual | Short fictional fixtures only; not normal CI. |

## Known Constraints

| Constraint | Severity | Current handling | Next production-grade option |
|---|---|---|---|
| Live AI calls are key-gated | Medium | Screenshots and evidence show the core UX without external AI cost. | Provide a short demo video if key distribution becomes a practical blocker. |
| Citation quality is not a full factuality guarantee | Medium | Runtime validation and eval utilities record accepted/drop reason counts. Raw diagnostics stay in tests/evidence, not end-user UI. | Re-run manual live eval after deploy so production JSON includes the new stats snapshot. |
| Anthropic SDK event shapes can change | Medium | SDK stream handling is isolated in an adapter and covered by targeted unit tests. | Re-check adapter tests after SDK updates. |
| Rate Limiting binding is abuse protection, not exact global accounting | Medium | Access key, scoped rate limits, cache-assisted limiter, and Anthropic spend limit are layered. | Durable Objects or another centralized quota system for stricter global accounting. |
| Moderate npm advisories remain | Medium | CI blocks high/critical; moderate items are documented with current exposure. | Track upstream framework releases and remove advisories when possible. |

## Not Performed

- No credential guessing.
- No load test.
- No uncontrolled live AI calls.
- No private or real user documents.
- No production rate-limit burst test unless a safe low threshold is configured.
