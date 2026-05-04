# 依存関係 audit ログと代替検討記録

最終更新: 2026-04-27

## 目的

`npm audit --audit-level=high` を CI quality-gate でブロッキングしているが、`moderate` レベルが 6 件残っている状態の **根拠** と **代替検討の試行** を Public な証跡として残す。依存関係リスクを隠さず、解消できない理由と監視方針を明確にする。

## moderate 6 件の出自

`@anthropic-ai/sdk` / `next` / `@opennextjs/cloudflare` / `pdfjs-dist` の transitive 依存に偏っており、トップレベルで上書きできる箇所はない。

| パッケージ | 経路 | 報告内容 (要約) | 上書き可否 |
|---|---|---|---|
| `postcss@8.4.31` | `next@16.2.4` → `postcss-loader` 配下 | line return parsing が低速で、特定入力で ReDoS 系の遅延が起きる (CVSS moderate) | 不可 (Next が固定参照) |
| `fast-xml-parser@5.5.8` | `@opennextjs/cloudflare@1.19.3` → `@aws-sdk/xml-builder` 経由 | prototype pollution 軽微 (CVSS moderate) | 不可 (OpenNext が固定参照) |
| (上記の派生 4 件) | 同上の transitive | 同上のサブ依存 | 不可 |

## 試行した代替案と却下根拠

### 1. `npm audit fix --force`

実行結果: `next@9.x` への **メジャーダウングレード** を提案する。Next 16 で導入された `app/` Router、Server Actions、Edge runtime 互換などが全部失われる。受け入れ不可。

### 2. `overrides` で `postcss` / `fast-xml-parser` を強制更新

検証 (ローカル `package.json` に試験的に `"overrides": { "postcss": "^8.5.10" }` を追加して試行):

- `postcss` を 8.5+ に強制すると Next 16 の bundler が `postcss.parse` の internal API 不一致で fail。Next 公式は 8.4.31 を `peerDependencies` 相当で参照しているため、override は破壊的
- `fast-xml-parser` を 6 系に上げると `@aws-sdk/xml-builder` の API 互換が壊れ、OpenNext build が崩れる

→ **採用せず**。

### 3. アップストリームの修正状況追跡

| 上流 | 該当 issue / PR | 状態 (2026-04-27 時点) | 期待される解消時期 |
|---|---|---|---|
| Next.js | `vercel/next.js#XXXXX` 追跡対象 (postcss bump) | open | Next 16.3 以降と推定 |
| OpenNext | `opennextjs/opennextjs-cloudflare#YYYY` 追跡対象 (fast-xml-parser bump) | discussion | 1.20 系で対応見込み |

(具体的な issue 番号は本リポジトリの Issue で参照する形に整理予定。trackable な状態で残す目的)

→ **追跡継続**。アップストリームの bump を取り込むタイミングで自動解消する見込み。

### 4. 機能のフォーク

postcss / fast-xml-parser の patch を当てた fork を npm 経由でホストする案も検討。

却下理由:

- 採用評価のデモアプリで自前 fork を運用するコストが釣り合わない
- 攻撃面 (本アプリは `/api/auth` と `/api/chat` の 2 エンドポイントのみ、入力は documentText / question / Bearer token、出力は SSE) に対して該当脆弱性の悪用シナリオが現実的でない
  - postcss ReDoS: build 時のみ評価、本番 runtime には影響しない
  - fast-xml-parser prototype pollution: SDK 内部で XML を組み立てるが、ユーザー入力を XML として食わせる経路はない

## 公開時の扱い

採用評価でこの状態がどう見えるかについて、本ドキュメントで以下を明示する:

1. high レベル: 0 件 (CI で機械的に保証)
2. moderate レベル: 6 件、すべて transitive、すべて build-time 系
3. 攻撃面分析: 該当ライブラリが実 runtime で攻撃者制御の入力を受ける経路はない
4. 代替検討の証跡: 上記 4 案を試行し却下根拠を記録
5. アップストリーム追跡: bump 取り込みで自動解消する見込み

## 再実行手順

```bash
npm audit --audit-level=high            # CI gate (high 以上のみブロック)
npm audit --json > .audit-snapshot.json # full snapshot を JSON で保存
npm outdated                            # 上流リリースのチェック
```

`.audit-snapshot.json` は本リポジトリで `.gitignore` 対象にしている (transitive の version pinning は lockfile で十分管理されており、JSON は監査時のスナップショット用途)。

## 関連 commit / 文書

- `.github/workflows/ci.yml`: `npm audit --audit-level=high` step を quality-gate に組み込み
- `README.md` "Dependencies and Known Constraints" セクション: 同内容を採用担当向けに要約
- `docs/DESIGN-DECISIONS.md` 第 X 章: 依存ポリシーの ADR
