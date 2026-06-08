# release基準の確認記録

日付: 2026-04-28

## 目的

次のrelease品質改善に入る前のproject状態を記録する。

## repository情報

- Project: `citation-reader`
- Branch: `main`
- HEAD: `c4ffaafdadc4020958300d91b5a8870e94e5c74b`
- Last commit: `c4ffaaf Lighthouse本番計測の証跡を追加`
- 確認時のworking tree: clean
- Remote `main`: `c4ffaafdadc4020958300d91b5a8870e94e5c74b`

## public URL確認

- URL: `https://citation-reader.atlas-lab.workers.dev`
- Method: `HEAD`
- Status: `200`
- Server: `cloudflare`

## GitHub Actions確認

- Repository: `proto-atlas/citation-reader`
- Latest workflow: `CI`
- Run ID: `25050114372`
- Status: `completed`
- 結論: `成功`
- 作成日時: `2026-04-28T11:26:58Z`
- Head SHA: `c4ffaafdadc4020958300d91b5a8870e94e5c74b`
- URL: `https://github.com/proto-atlas/citation-reader/actions/runs/25050114372`

## ローカル確認

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | 通過 | `tsc --noEmit`, exit 0 |
| `npm run lint` | 通過 | ESLint and Prettier check passed |
| `npm run test` | 通過 | 11 files / 134 tests通過 |
| `npm run test:coverage` | 通過 | 11 files / 134 tests通過 |
| `npm run build` | 通過 | Next.js 16.2.4 webpack build succeeded |
| `git diff --check` | 通過 | no whitespace errors |

coverage集計:

| Metric | Value |
|---|---:|
| Statements | 80.14% |
| Branches | 78.43% |
| Functions | 81.25% |
| Lines | 82.20% |

build routes:

- `/`
- `/_not-found`
- `/api/auth`
- `/api/chat`
- `/icon.svg`

## 実行環境の補足

sandbox環境のVitestとNext.js buildは `spawn EPERM` で失敗しました。
同じコマンドを通常実行権限で再実行し、passした。
これはproject failureではなく、実行環境上の制約として記録する。

## 結論

HEAD `c4ffaafdadc4020958300d91b5a8870e94e5c74b` 時点でworking treeはcleanで、deploy可能な状態として記録した。
