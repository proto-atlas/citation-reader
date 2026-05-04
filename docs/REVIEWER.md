# Reviewer Guide

## 30秒で見る

- Public demo: https://citation-reader.atlas-lab.workers.dev
- Public materials: screenshots and evidence show the citation UI without calling external AI APIs.
- Source: https://github.com/proto-atlas/citation-reader

## 5分で見る

- Read the README feature list and access-key rationale.
- Check the evidence map: [docs/evidence/REVIEWER-INDEX.md](./evidence/REVIEWER-INDEX.md)
- Review the chat API boundary: `src/app/api/chat/route.ts`
- Review citation UI behavior: `src/components/AnswerView.tsx`
- Review design tradeoffs: [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)

## 技術的な見どころ

- Anthropic Citations API の streaming event を、アプリ側の SSE event に正規化して表示している。
- 引用バッジと原文ハイライトを分け、回答本文と citation source の対応を UI 上で追える。
- PDF はブラウザ側で `pdfjs-dist` により抽出し、PDF binary をサーバーへ送らない。
- live Q&A は access key、短期 session cookie、rate limit、Anthropic Spend Limit を重ねた cost guard として扱う。
- LLM eval は短い架空 fixture に限定し、引用件数・重複・Markdown混入などを証跡として残している。

## 公開範囲とキー保護範囲

| Area | Access key | Notes |
|---|---:|---|
| Screenshots | No | Generated from controlled fixtures. |
| README / evidence | No | Public documentation and point-in-time verification logs. |
| Live Q&A | Yes | Access-key gated to reduce abuse and unexpected API cost. |
| Live AI eval | Manual | Uses short fictional fixtures and is not part of normal CI. |

## Evidence 方針

Evidence files are point-in-time logs, not a claim of latest HEAD. For third-party review, the reviewed commit and CI run should be specified externally.

Evidence should not include secrets, access keys, cookies, API keys, local filesystem paths, self-scoring context, or internal implementation-plan notes.

## デフォルトでは実施しないこと

- No credential guessing.
- No load test.
- No uncontrolled live AI calls.
- No private or real user documents.
- No production rate-limit burst test unless the threshold can be reached safely with a small number of requests.
