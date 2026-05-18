// Anthropic SDK 0.90 の citations_delta 由来 raw payload を、本アプリ用の `CitationLocation` 型に
// 正規化する変換関数。
//
// SDK 由来 payload を runtime validation してからアプリ用の型に正規化する。
// - SDK の `delta.citation` は `unknown` 由来の構造で、ランタイムに以下のような複数の type を取る
//   (char_location / page_location / content_block_location)。
// - 受け取り側は `CitationLocation` 型を期待するため、以前は `as unknown as CitationLocation` で
//   逃げていたが、shape が変わったときに気付けない。本変換関数で形を最低限検査して、
//   不整合は null を返す。

import type { CitationLocation } from './types';

const VALID_TYPES = new Set(['char_location', 'page_location', 'content_block_location']);

export interface CitationValidationStats {
  received: number;
  accepted: number;
  droppedInvalidBounds: number;
  droppedTextMismatch: number;
  droppedMissingDocument: number;
  droppedDuplicate: number;
}

export interface CitationValidationBatchResult {
  citations: CitationLocation[];
  stats: CitationValidationStats;
}

interface CitationValidationBatchOptions {
  documentTexts?: readonly string[];
  dropDuplicates?: boolean;
}

export function createCitationValidationStats(): CitationValidationStats {
  return {
    received: 0,
    accepted: 0,
    droppedInvalidBounds: 0,
    droppedTextMismatch: 0,
    droppedMissingDocument: 0,
    droppedDuplicate: 0,
  };
}

function isPositiveIntOrUndefined(value: unknown): value is number | undefined {
  return (
    value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
  );
}

/**
 * 任意の入力 (SDK の citations_delta.citation) を CitationLocation に正規化する。
 * 必須フィールド (type / cited_text / document_index) が揃っていない、または
 * type が想定外の場合は null を返す。
 */
export function toCitationLocation(input: unknown): CitationLocation | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  const type = obj.type;
  if (typeof type !== 'string' || !VALID_TYPES.has(type)) return null;

  const cited_text = obj.cited_text;
  if (typeof cited_text !== 'string') return null;

  const document_index = obj.document_index;
  // 整数 + 非負を要求。負の document_index は SDK 仕様にない値で、optional の char/page/block index と
  // 整合性を取るため拒否する。
  if (typeof document_index !== 'number' || !Number.isInteger(document_index) || document_index < 0)
    return null;

  // 任意フィールドは存在すれば型を確認、無ければ undefined のまま通す
  const document_title =
    obj.document_title === null
      ? null
      : typeof obj.document_title === 'string'
        ? obj.document_title
        : undefined;

  // narrowing 後の number | undefined を局所変数で確定 (lint の no-unnecessary-type-assertion 回避)
  const start_char_index = obj.start_char_index;
  const end_char_index = obj.end_char_index;
  const start_page_number = obj.start_page_number;
  const end_page_number = obj.end_page_number;
  const start_block_index = obj.start_block_index;
  const end_block_index = obj.end_block_index;
  if (!isPositiveIntOrUndefined(start_char_index)) return null;
  if (!isPositiveIntOrUndefined(end_char_index)) return null;
  if (!isPositiveIntOrUndefined(start_page_number)) return null;
  if (!isPositiveIntOrUndefined(end_page_number)) return null;
  if (!isPositiveIntOrUndefined(start_block_index)) return null;
  if (!isPositiveIntOrUndefined(end_block_index)) return null;

  return {
    type: type as CitationLocation['type'],
    cited_text,
    document_index,
    document_title,
    start_char_index,
    end_char_index,
    start_page_number,
    end_page_number,
    start_block_index,
    end_block_index,
  };
}

export function validateCitationBatch(
  inputs: readonly unknown[],
  options: CitationValidationBatchOptions = {},
): CitationValidationBatchResult {
  const stats = createCitationValidationStats();
  const citations: CitationLocation[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    stats.received += 1;
    const citation = toCitationLocation(input);
    if (!citation || hasInvalidCharBounds(citation, options.documentTexts)) {
      stats.droppedInvalidBounds += 1;
      continue;
    }

    const documentText = options.documentTexts?.[citation.document_index];
    if (options.documentTexts && documentText === undefined) {
      stats.droppedMissingDocument += 1;
      continue;
    }

    if (documentText !== undefined && !documentText.includes(citation.cited_text)) {
      stats.droppedTextMismatch += 1;
      continue;
    }

    const key = citationSignature(citation);
    if (options.dropDuplicates !== false && seen.has(key)) {
      stats.droppedDuplicate += 1;
      continue;
    }

    seen.add(key);
    citations.push(citation);
    stats.accepted += 1;
  }

  return { citations, stats };
}

function hasInvalidCharBounds(
  citation: CitationLocation,
  documentTexts: readonly string[] | undefined,
): boolean {
  const { start_char_index, end_char_index } = citation;
  if (
    start_char_index !== undefined &&
    end_char_index !== undefined &&
    end_char_index < start_char_index
  )
    return true;
  const documentText = documentTexts?.[citation.document_index];
  if (documentText === undefined) return false;
  if (start_char_index !== undefined && start_char_index > documentText.length) return true;
  if (end_char_index !== undefined && end_char_index > documentText.length) return true;
  return false;
}

function citationSignature(citation: CitationLocation): string {
  return [
    citation.type,
    citation.document_index,
    citation.start_char_index ?? '',
    citation.end_char_index ?? '',
    citation.start_page_number ?? '',
    citation.end_page_number ?? '',
    citation.start_block_index ?? '',
    citation.end_block_index ?? '',
    citation.cited_text,
  ].join('|');
}
