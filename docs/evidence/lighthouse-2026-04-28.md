# Lighthouse Production Report (2026-04-28)

## 対象

- URL: https://citation-reader.atlas-lab.workers.dev/
- Tool: Lighthouse 13.0.1
- 実行環境: Windows + Microsoft Edge headless (`CHROME_PATH`)
- JSON:
  - [`lighthouse-desktop-2026-04-28.json`](./lighthouse-desktop-2026-04-28.json)
  - [`lighthouse-mobile-2026-04-28.json`](./lighthouse-mobile-2026-04-28.json)

## スコア

| Strategy | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| desktop | 99 | 95 | 100 | 100 |
| mobile | 89 | 95 | 100 | 100 |

## Core Web Vitals / 主要指標

| Strategy | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|
| desktop | 0.5 s | 0.7 s | 10 ms | 0 |
| mobile | 0.8 s | 2.0 s | 410 ms | 0 |

## 注意

Lighthouse CLI は計測 JSON 作成後、Windows Temp 内の profile cleanup で `EPERM` を返して exit 1 になった。JSON は生成済みで、上記スコアは JSON から抽出した値。

PageSpeed Insights API は 429 `Quota exceeded` で利用不可だったため、ローカル Lighthouse CLI + Edge headless で再計測した。
