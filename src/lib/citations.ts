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
