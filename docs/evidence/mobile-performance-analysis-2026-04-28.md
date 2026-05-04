# Mobile Performance Analysis

Date: 2026-04-28

## Source

- Lighthouse JSON: [`lighthouse-mobile-2026-04-28.json`](./lighthouse-mobile-2026-04-28.json)
- Summary: [`lighthouse-2026-04-28.md`](./lighthouse-2026-04-28.md)
- Target: `https://citation-reader.atlas-lab.workers.dev/`

## Scores

| Category | Score |
|---|---:|
| Performance | 89 |
| Accessibility | 95 |
| Best Practices | 100 |
| SEO | 100 |

## Key Metrics

| Metric | Value |
|---|---:|
| First Contentful Paint | 0.8 s |
| Largest Contentful Paint | 2.0 s |
| Total Blocking Time | 410 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 1.4 s |
| Main-thread work | 1.3 s |
| JavaScript execution | 0.5 s |

## Interpretation

The mobile score is just below 90 because Total Blocking Time is the limiting metric.
FCP, LCP, CLS, Best Practices, and SEO are already strong.

Likely contributors:

- The app ships an interactive document reader UI rather than a static landing page.
- PDF extraction support and citation rendering increase client-side JavaScript work.
- The auth gate and theme/session setup still hydrate on mobile.

## Decision

No broad performance refactor is made in this pass.
Reason: the current public UI already meets the release target, and the higher-priority evidence gap was live AI behavior rather than page load.

Next optimization candidates:

1. Defer PDF extraction code until file upload.
2. Keep sample document loading and citation rendering out of the initial critical path where possible.
3. Re-run mobile Lighthouse after any client bundle split.

## Conclusion

The mobile performance score of 89 is understood and documented.
The remaining performance risk is acceptable for the current demo because the app is an authenticated AI tool, not a static marketing page.
