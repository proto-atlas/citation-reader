#!/usr/bin/env node
/**
 * postinstallで呼ばれる。pdfjs-distのworkerをpublic/ にコピーする。
 *
 * なぜ必要か:
 *   pdfjs-distはPDF解析をWeb Workerで行う設計で、
 *   `/pdf.worker.min.mjs` を同一オリジンからfetchする必要がある。
 *   public/ に同梱することでCORS回避、バージョン一致保証、
 *   Cloudflare WorkersのASSETS binding経由で配信できる。
 *
 * なぜcommitしないか:
 *   pdfjs-distの更新時に差分が大きくなるのと、バイナリに近い生成物を
 *   リポに置きたくないため。.gitignore対象にし、npm ci時にpostinstallで
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
