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
 * live モードでは本番 /api/chat に短い fixture を送る。ACCESS_KEY は環境変数でのみ
 * 受け取り、出力 JSON には保存しない。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateChatEvents, buildLiveSampleResult, parseSseEvents } from './sse-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function readLimit(args) {
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  if (!limitArg) return undefined;
  const parsed = Number(limitArg.slice('--limit='.length));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('--limit must be a positive integer');
  }
  return parsed;
}

async function runLiveSample(baseUrl, accessKey, sample) {
  const url = new URL('/api/chat', baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentText: sample.documentText,
      question: sample.question,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const contentType = response.headers.get('content-type');
  const body = await response.text();
  if (!response.ok) {
    return {
      id: sample.id,
      passed: false,
      status: response.status,
      contentType,
      model: undefined,
      answerText: '',
      citationCount: 0,
      citations: [],
      usage: undefined,
      errors: [`http_${response.status}`],
      eventCount: 0,
      responsePreview: body.slice(0, 300),
    };
  }

  const events = parseSseEvents(body);
  const aggregate = aggregateChatEvents(events);
  return buildLiveSampleResult({
    id: sample.id,
    status: response.status,
    contentType,
    events,
    aggregate,
    documentTexts: [sample.documentText],
  });
}

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
    const limit = readLimit(args) ?? samples.length;
    const selectedSamples = samples.slice(0, limit);
    console.log(`[eval] running ${selectedSamples.length} live sample(s) against ${baseUrl}`);

    const dateStr = new Date().toISOString().slice(0, 10);
    const outputDir = resolve(repoRoot, 'docs/evidence');
    await mkdir(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, `eval-result-${dateStr}.json`);

    const results = [];
    for (const sample of selectedSamples) {
      console.log(`[eval] live sample = ${sample.id}`);
      results.push(await runLiveSample(baseUrl, accessKey, sample));
    }

    const payload = {
      runDate: dateStr,
      mode,
      baseUrl,
      sampleCount: selectedSamples.length,
      passed: results.every((result) => result.passed),
      note: 'ACCESS_KEY and ANTHROPIC_API_KEY are never written to this evidence file. Inputs are short fictional fixtures from eval/sample-cases.json.',
      samples: results,
    };

    await writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log(`[eval] wrote live result to ${outputPath}`);
    if (!payload.passed) process.exit(1);
    return;
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
    note: 'mock モード。実 Anthropic API は呼び出さず、sample fixture の読み込みと evidence 書き出し経路だけを確認する。',
    samples: samples.map((s) => ({ id: s.id, questionLanguage: s.questionLanguage })),
  };

  await writeFile(outputPath, JSON.stringify(placeholder, null, 2));
  console.log(`[eval] wrote placeholder result to ${outputPath}`);
}

main().catch((err) => {
  console.error('[eval] fatal error:', err);
  process.exit(1);
});
