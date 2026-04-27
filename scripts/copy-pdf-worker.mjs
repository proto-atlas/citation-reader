#!/usr/bin/env node
/**
 * postinstall で呼ばれる。pdfjs-dist の worker を public/ にコピーする。
 *
 * なぜ必要か:
 *   pdfjs-dist は PDF 解析を Web Worker で行う設計で、
 *   `/pdf.worker.min.mjs` を同一オリジンから fetch する必要がある。
 *   public/ に同梱することで CORS 回避、バージョン一致保証、
 *   Cloudflare Workers の ASSETS binding 経由で配信できる。
 *
 * なぜ commit しないか:
 *   pdfjs-dist の更新時に差分が大きくなるのと、バイナリに近い生成物を
 *   リポに置きたくないため。.gitignore 対象にし、npm ci 時に postinstall で
 *   再生成する方式にしている。
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const src = resolve(projectRoot, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dst = resolve(projectRoot, 'public/pdf.worker.min.mjs');

mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);

console.log(`[copy-pdf-worker] ${src} -> ${dst}`);
