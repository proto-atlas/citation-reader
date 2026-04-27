#!/usr/bin/env bash
# 公開前禁止ワード検出スクリプト
# ローカル用 _docs/DANGER-WORDS.txt の全パターンを grep
# ヒットがあれば exit 1

set -eu

# スクリプトの場所から _docs/DANGER-WORDS.txt を探す
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 候補パスを順に試す
DANGER_WORDS_FILE=""
for candidate in \
  "$SCRIPT_DIR/../_docs/DANGER-WORDS.txt" \
  "$SCRIPT_DIR/../../_docs/DANGER-WORDS.txt" \
  "$SCRIPT_DIR/../_docs/DANGER-WORDS.txt"; do
  if [ -f "$candidate" ]; then
    DANGER_WORDS_FILE="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
    break
  fi
done

if [ -z "$DANGER_WORDS_FILE" ] || [ ! -f "$DANGER_WORDS_FILE" ]; then
  echo "!! DANGER-WORDS.txt が見つかりません"
  echo "探索した候補:"
  echo "  $SCRIPT_DIR/../_docs/DANGER-WORDS.txt"
  echo "  $SCRIPT_DIR/../../_docs/DANGER-WORDS.txt"
  exit 2
fi

echo "DANGER-WORDS.txt: $DANGER_WORDS_FILE"
echo "Scanning project for danger words..."
echo ""

EXIT_CODE=0
HITS_TOTAL=0

while IFS= read -r line || [ -n "$line" ]; do
  # 前後の空白削除
  trimmed="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  # コメント行・空行スキップ
  if [ -z "$trimmed" ] || [[ "$trimmed" =~ ^# ]]; then
    continue
  fi

  # プロジェクトルート（スクリプトから見た親の親）で grep
  # .env* / .dev.vars はローカル専用かつ gitignore 対象なので除外（grep 結果が stdout に出ると
  # transcript 等にシークレットが露出するため。gitignore で公開リスクは既に塞いでいる）
  hits="$(grep -rnE \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=.next \
    --exclude-dir=.nuxt \
    --exclude-dir=.output \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=coverage \
    --exclude-dir=playwright-report \
    --exclude-dir=test-results \
    --exclude-dir=.wrangler \
    --exclude-dir=.open-next \
    --exclude-dir=.husky \
    --exclude='DANGER-WORDS.txt' \
    --exclude='check-before-publish.sh' \
    --exclude='check-secrets.sh' \
    --exclude='SPEC.md' \
    --exclude='PROGRESS.md' \
    --exclude='job-description.md' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='.dev.vars' \
    -- "$trimmed" . 2>/dev/null || true)"

  if [ -n "$hits" ]; then
    # ヒット値そのものを出すとログにシークレットや非公開語が流れるため、
    # ファイル名と行番号だけ表示し、値は伏字にする
    echo "!! HIT: pattern matched (value redacted)"
    redacted="$(printf '%s\n' "$hits" | awk -F: 'NF>=3 {printf "  %s:%s: [REDACTED]\n", $1, $2}')"
    printf '%s\n' "$redacted" | head -5
    hit_count=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
    if [ "$hit_count" -gt 5 ]; then
      echo "  ... (他 $((hit_count - 5)) 件)"
    fi
    echo "---"
    HITS_TOTAL=$((HITS_TOTAL + hit_count))
    EXIT_CODE=1
  fi
done < "$DANGER_WORDS_FILE"

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "OK: DANGER-WORDS.txt 全パターン検出ゼロ"
else
  echo "!! NG: 合計 $HITS_TOTAL 件のヒット。上記を確認して修正してください。"
fi

exit $EXIT_CODE
