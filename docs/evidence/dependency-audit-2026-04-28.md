# Dependency Audit (2026-04-28)

## 対象

- Project: `citation-reader`
- Command: `npm audit --audit-level=high --json`
- 実行日: 2026-04-28

## 結果

| Level | Count |
|---|---:|
| info | 0 |
| low | 0 |
| moderate | 6 |
| high | 0 |
| critical | 0 |
| total | 6 |

| Dependency kind | Count |
|---|---:|
| prod | 364 |
| dev | 212 |
| optional | 181 |
| peer | 0 |
| peerOptional | 0 |
| total | 687 |

## 判定

`npm audit --audit-level=high --json` は exit 0。high / critical は 0 件。moderate 6 件は残存している。

moderate 6 件の出自、代替検討、採用評価上の扱いは [`dependency-audit-2026-04-27.md`](./dependency-audit-2026-04-27.md) に記録済み。
