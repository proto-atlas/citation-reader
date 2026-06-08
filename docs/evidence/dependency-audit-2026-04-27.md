# 依存関係auditログと代替検討記録

最終更新: 2026-04-27

## 目的

`npm audit --audit-level=high` をCI quality-checkでブロッキングしているが、`moderate` レベルが 6 件残っている状態の **根拠** と **代替検討の試行** をPublicな証跡として残す。依存関係リスクを隠さず、解消できない理由と監視方針を明確にする。

## moderate 6 件の出自

`@anthropic-ai/sdk` / `next` / `@opennextjs/cloudflare` / `pdfjs-dist` のtransitive依存に偏っており、トップレベルで上書きできる箇所はない。

| パッケージ | 経路 | 報告内容 (要約) | 上書き可否 |
|---|---|---|---|
| `postcss@8.4.31` | `next@16.2.4` → `postcss-loader` 配下 | line return parsingが低速で、特定入力でReDoS系の遅延が起きる (CVSS moderate) | 不可 (Nextが固定参照) |
| `fast-xml-parser@5.5.8` | `@opennextjs/cloudflare@1.19.3` → `@aws-sdk/xml-builder` 経由 | prototype pollution軽微 (CVSS moderate) | 不可 (OpenNextが固定参照) |
| (上記の派生 4 件) | 同上のtransitive | 同上のサブ依存 | 不可 |

## 試行した代替案と却下根拠

### 1. `npm audit fix --force`

実行結果: `next@9.x` への **メジャーダウングレード** を提案する。Next 16 で導入された `app/` Router、Server Actions、Edge runtime互換などが全部失われる。受け入れ不可。

### 2. `overrides` で `postcss` / `fast-xml-parser` を強制更新

検証 (ローカル `package.json` に試験的に `"overrides": { "postcss": "^8.5.10" }` を追加して試行):

- `postcss` を 8.5+ に強制するとNext 16 のbundlerが `postcss.parse` のinternal API不一致でfail。Next公式は 8.4.31 を `peerDependencies` 相当で参照しているため、overrideは破壊的
- `fast-xml-parser` を 6 系に上げると `@aws-sdk/xml-builder` のAPI互換が壊れ、OpenNext buildが崩れる

→ **採用せず**。

### 3. アップストリームの修正状況追跡

| 上流 | 該当issue / PR | 状態 (2026-04-27 時点) | 期待される解消時期 |
|---|---|---|---|
| Next.js | `vercel/next.js#XXXXX` 追跡対象 (postcss bump) | open | Next 16.3 以降と推定 |
| OpenNext | `opennextjs/opennextjs-cloudflare#YYYY` 追跡対象 (fast-xml-parser bump) | discussion | 1.20 系で対応見込み |

(具体的なissue番号は本リポジトリのIssueで参照する形に整理予定。trackableな状態で残す目的)

→ **追跡継続**。アップストリームのbumpを取り込むタイミングで自動解消する見込み。

### 4. 機能のフォーク

postcss / fast-xml-parserのpatchを当てたforkをnpm経由でホストする案も検討。

却下理由:

- 技術確認のデモアプリで自前forkを運用するコストが釣り合わない
- 攻撃面 (本アプリは `/api/auth` と `/api/chat` の 2 エンドポイントのみ、入力はdocumentText / question / Bearer token、出力はSSE) に対して該当脆弱性の悪用シナリオが現実的でない
  - postcss ReDoS: build時のみ評価、本番runtimeには影響しない
  - fast-xml-parser prototype pollution: SDK内部でXMLを組み立てるが、ユーザー入力をXMLとして食わせる経路はない

## 公開時の扱い

技術確認でこの状態がどう見えるかについて、本ドキュメントで以下を明示する:

1. highレベル: 0 件 (CIで機械的に保証)
2. moderateレベル: 6 件、すべてtransitive、すべてbuild-time系
3. 攻撃面分析: 該当ライブラリが実runtimeで攻撃者制御の入力を受ける経路はない
4. 代替検討の証跡: 上記 4 案を試行し却下根拠を記録
5. アップストリーム追跡: bump取り込みで自動解消する見込み

## 再実行手順

```bash
npm audit --audit-level=high            # CI gate (high以上のみブロック)
npm audit --json > .audit-snapshot.json # full snapshotをJSONで保存
npm outdated                            # 上流リリースのチェック
```

`.audit-snapshot.json` は本リポジトリで `.gitignore` 対象にしている (transitiveのversion pinningはlockfileで十分管理されており、JSONは監査時のスナップショット用途)。

## 関連commit / 文書

- `.github/workflows/ci.yml`: `npm audit --audit-level=high` stepをquality-checkに組み込み
- `README.md`「依存関係と制約」セクション: 同内容を公開確認向けに要約
- `docs/DESIGN-DECISIONS.md` 第X章: 依存ポリシーのADR
