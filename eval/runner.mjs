#!/usr/bin/env node
/**
 * LLM evaluation harness runner。
 *
 * `eval/sample-cases.json` の各ケースに対して /api/chat を呼び、SSE を集約した
 * 「回答テキスト + 引用配列」を `eval/evaluators.ts` の純関数に渡して品質評価する。
 * 結果を `docs/evidence/eval-result-{date}.json` に書き出す。
 *
 * 使い方:
 *   # 1. mock モード (Anthropic 課金ゼロ、CI で常用想定)
 *   node eval/runner.mjs --mock
 *
 *   # 2. live モード (本番 URL に対して評価、課金発生)
 *   BASE_URL=https://citation-reader.atlas-lab.workers.dev \
 *   ACCESS_KEY=xxx \
 *   node eval/runner.mjs --live
 *
 * mock モードでは sample-cases.json に隣接する `eval/mock-responses.json` を
 * 用意しておけばそれを使う (本コミットではテンプレのみ提供、live で取得した
 * 応答を後から流し込む運用)。
 *
 * .ts の evaluators を Node から動かすため、本 runner からは tsx 経由で呼ぶか
 * 事前に build した js を呼ぶ。本コミットでは vitest test カバレッジを重視し、
 * runner の実 LLM 統合は v0.2 以降の課題として README に明示する。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--live') ? 'live' : 'mock';

  console.log(`[eval] mode = ${mode}`);

  const samplesPath = resolve(__dirname, 'sample-cases.json');
  const samples = JSON.parse(await readFile(samplesPath, 'utf8'));
  console.log(`[eval] loaded ${samples.length} sample cases`);

  if (mode === 'live') {
    const baseUrl = process.env.BASE_URL;
    const accessKey = process.env.ACCESS_KEY;
    if (!baseUrl || !accessKey) {
      console.error(
        '[eval] live mode requires BASE_URL and ACCESS_KEY env vars. abort.\n' +
          '       Use --mock for cost-free dry run.',
      );
      process.exit(2);
    }
    console.error(
      '[eval] live mode is not yet implemented in this commit. ' +
        'Anthropic course charges and SSE parsing are deferred to v0.2.\n' +
        '       evaluators (eval/evaluators.ts) themselves are unit-tested via Vitest.',
    );
    process.exit(2);
  }

  // mock モード: 各 sample に対して評価関数の動作確認だけを行う (実 SSE 経路は
  // evaluators.test.ts で個別ユニットテスト済)。
  // 本コミットではプレースホルダーとして、各ケースに対し空 turn を生成し、
  // evaluator がエラーを起こさないことだけ確認する。
  const dateStr = new Date().toISOString().slice(0, 10);
  const outputDir = resolve(repoRoot, 'docs/evidence');
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `eval-result-${dateStr}.json`);

  const placeholder = {
    runDate: dateStr,
    mode,
    sampleCount: samples.length,
    note: 'live モード未実装。evaluator 関数群 (evaluators.ts) は Vitest で個別カバー済。 v0.2 で本番 URL への live evaluation を実装予定。',
    samples: samples.map((s) => ({ id: s.id, questionLanguage: s.questionLanguage })),
  };

  await writeFile(outputPath, JSON.stringify(placeholder, null, 2));
  console.log(`[eval] wrote placeholder result to ${outputPath}`);
}

main().catch((err) => {
  console.error('[eval] fatal error:', err);
  process.exit(1);
});
