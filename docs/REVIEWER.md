# Reviewer Guide

## 30 seconds

- Public demo: https://citation-reader.atlas-lab.workers.dev
- Public materials: screenshots and evidence show the citation UI without calling external AI APIs.
- Source: https://github.com/proto-atlas/citation-reader

## 5 minutes

- Read the README feature list and access-key rationale.
- Check the evidence map: [docs/evidence/REVIEWER-INDEX.md](./evidence/REVIEWER-INDEX.md)
- Review the chat API boundary: `src/app/api/chat/route.ts`
- Review citation UI behavior: `src/components/AnswerView.tsx`
- Review design tradeoffs: [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)

## Public and Key-Gated Scope

| Area | Access key | Notes |
|---|---:|---|
| Screenshots | No | Generated from controlled fixtures. |
| README / evidence | No | Public documentation and point-in-time verification logs. |
| Live Q&A | Yes | Access-key gated to reduce abuse and unexpected API cost. |
| Live AI eval | Manual | Uses short fictional fixtures and is not part of normal CI. |

## Evidence Policy

Evidence files are point-in-time logs, not a claim of latest HEAD. For third-party review, the reviewed commit and CI run should be specified externally.

Evidence should not include secrets, access keys, cookies, API keys, local filesystem paths, self-scoring context, or internal implementation-plan notes.

## Not Performed by Default

- No credential guessing.
- No load test.
- No uncontrolled live AI calls.
- No private or real user documents.
- No production rate-limit burst test unless the threshold can be reached safely with a small number of requests.
