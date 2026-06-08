# mobile performance分析

日付: 2026-04-28

## 元データ

- Lighthouse JSON: [`lighthouse-mobile-2026-04-28.json`](./lighthouse-mobile-2026-04-28.json)
- Summary: [`lighthouse-2026-04-28.md`](./lighthouse-2026-04-28.md)
- Target: `https://citation-reader.atlas-lab.workers.dev/`

## スコア

| カテゴリ | スコア |
|---|---:|
| Performance | 89 |
| Accessibility | 95 |
| Best Practices | 100 |
| SEO | 100 |

## 主な指標

| 指標 | 値 |
|---|---:|
| First Contentful Paint | 0.8 s |
| Largest Contentful Paint | 2.0 s |
| Total Blocking Time | 410 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 1.4 s |
| Main-thread work | 1.3 s |
| JavaScript execution | 0.5 s |

## 解釈

mobileスコアが90を少し下回っている主因は、Total Blocking Timeです。
FCP、LCP、CLS、Best Practices、SEOはすでに良好です。

主な要因候補:

- 静的なlanding pageではなく、interactiveなdocument reader UIを配信している。
- PDF抽出対応とcitation renderingにより、client-side JavaScriptの処理が増えている。
- auth gateとtheme/session setupもmobileでhydrateされる。

## 判断

この時点では広い性能改善は行いません。
理由は、現在の公開UIがrelease targetを満たしており、優先度の高い検証不足はpage loadではなく実API挙動だったためです。

次の最適化候補:

1. PDF抽出処理は、ファイルアップロード後に読み込む。
2. サンプル文書の読み込みと引用表示は、可能な範囲で初期表示の必須処理から外す。
3. クライアント側の分割読み込みを変更した場合は、モバイルLighthouseを再実行する。

## 結論

mobile performance score 89 の理由は把握し、記録済みです。
このアプリは静的な紹介ページではなく認証付きAIツールなので、現時点で残る性能上のリスクは許容範囲として扱います。
