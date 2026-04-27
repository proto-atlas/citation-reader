#!/usr/bin/env node
/**
 * 公開前禁止ワード検出スクリプト (Windows 互換版)。
 *
 * ローカル用 _docs/DANGER-WORDS.txt または公開用 fallback pattern を再帰 grep し、
 * ヒットがあれば exit 1。bash 版 (scripts/check-before-publish.sh) と
 * 同等の動作を Node.js 標準モジュールのみで再実装。
 *
 * check:publish が Windows で実行不可だった問題への
 * 対応。Linux / macOS / Git Bash でも問題なく動く。
 *
 * 出力は値そのものを表示せず [REDACTED] に置換 (transcript に秘密が流れない)。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// DANGER-WORDS.txt 候補パス (公開リポ外のローカル用ファイルがあれば利用)
const candidates = [
  resolve(__dirname, '../_docs/DANGER-WORDS.txt'),
  resolve(__dirname, '../../_docs/DANGER-WORDS.txt'),
];

let dangerWordsFile = null;
for (const candidate of candidates) {
  if (existsSync(candidate)) {
    dangerWordsFile = candidate;
    break;
  }
}

const publicFallbackPatterns = ['ghp_', 'github_pat_', 'sk-ant-', 'sk-proj-', 'AIza', 'AKIA'];

if (dangerWordsFile) {
  console.log(`DANGER-WORDS.txt: ${dangerWordsFile}`);
} else {
  console.log('DANGER-WORDS.txt: not found; using public fallback patterns');
}
console.log('Scanning project for danger words...\n');

// パターン読み込み (空行 / # コメント除外)
const patterns = dangerWordsFile
  ? readFileSync(dangerWordsFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  : publicFallbackPatterns;

// 除外ディレクトリ (bash 版の --exclude-dir と同じ + review-artifacts)
const excludeDirs = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.output',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.wrangler',
  '.open-next',
  '.husky',
  'review-artifacts',
]);

// 除外ファイル (bash 版の --exclude と同じ + .mjs 自身)
function isExcludedFile(name) {
  if (
    name === 'DANGER-WORDS.txt' ||
    name === 'check-before-publish.sh' ||
    name === 'check-before-publish.mjs' ||
    name === 'check-secrets.sh' ||
    name === 'SPEC.md' ||
    name === 'PROGRESS.md' ||
    name === 'job-description.md'
  ) {
    return true;
  }
  if (name.startsWith('.env')) return true;
  if (name === '.dev.vars') return true;
  return false;
}

// 再帰的にファイル一覧を取得 (バイナリ拡張子は除外)
const binaryExt = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
]);

function listFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      listFiles(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      const lower = entry.name.toLowerCase();
      const dotIdx = lower.lastIndexOf('.');
      if (dotIdx >= 0 && binaryExt.has(lower.slice(dotIdx))) continue;
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const files = listFiles(projectRoot);

let exitCode = 0;
let hitsTotal = 0;

for (const pattern of patterns) {
  // bash 版は grep -E (extended regex)。Node RegExp は ECMAScript regex (近似互換)。
  // DANGER-WORDS.txt は実体としてリテラル文字列が中心なので一般に互換。
  let re;
  try {
    re = new RegExp(pattern);
  } catch {
    console.error(`!! パターン解析失敗 (skip): ${pattern}`);
    continue;
  }
  const hits = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // 読めないファイルは飛ばす
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const rel = relative(projectRoot, file).replace(/\\/g, '/');
        hits.push({ file: rel, line: i + 1 });
      }
    }
  }
  if (hits.length > 0) {
    console.log('!! HIT: pattern matched (value redacted)');
    for (const h of hits.slice(0, 5)) {
      console.log(`  ${h.file}:${h.line}: [REDACTED]`);
    }
    if (hits.length > 5) {
      console.log(`  ... (他 ${hits.length - 5} 件)`);
    }
    console.log('---');
    hitsTotal += hits.length;
    exitCode = 1;
  }
}

console.log('');
if (exitCode === 0) {
  console.log('OK: DANGER-WORDS.txt 全パターン検出ゼロ');
} else {
  console.log(`!! NG: 合計 ${hitsTotal} 件のヒット。上記を確認して修正してください。`);
}

process.exit(exitCode);
