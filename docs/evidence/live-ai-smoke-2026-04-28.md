# Live AI Smoke

Date: 2026-04-28

## Scope

This smoke test verifies the production `/api/chat` path with a short fictional fixture.

## Target

- URL: `https://citation-reader.atlas-lab.workers.dev/api/chat`
- Mode: `live`
- Sample: `ja-edge-summary`
- Limit: `1`
- Result file: [`eval-result-2026-04-28.json`](./eval-result-2026-04-28.json)

## Result

- Passed: `true`
- HTTP status: `200`
- Content-Type: `text/event-stream; charset=utf-8`
- Model: `claude-haiku-4-5-20251001`
- Citation count: `1`
- SSE event count: `7`
- Errors: `[]`

Usage:

| Metric | Tokens |
|---|---:|
| input_tokens | 1027 |
| output_tokens | 129 |
| cache_creation_input_tokens | 0 |
| cache_read_input_tokens | 0 |

## Answer Summary

The model answered in Japanese and summarized the fixture as an edge computing and AI inference trend, while mentioning Cloudflare Workers' CPU / memory constraints and why bundling heavy ML models in a Worker is impractical.

## Citation Check

The response included one `char_location` citation from `User Document`.
The cited text comes from the short fictional fixture in `eval/sample-cases.json`.

## Secret Handling

- `ACCESS_KEY` was read from a local environment file and passed as an environment variable.
- `ACCESS_KEY` was not printed to stdout.
- `ACCESS_KEY` and `ANTHROPIC_API_KEY` are not written to the JSON evidence.
- The input fixture is fictional and safe to include in public evidence.

## Conclusion

The production `/api/chat` path successfully completed one live Anthropic-backed citation response with sanitized public evidence.
