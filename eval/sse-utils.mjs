/**
 * /api/chat の SSE 応答を live evaluation 用に集約する小さなユーティリティ。
 * ブラウザ UI と同じ ChatStreamEvent 形式だけを扱い、ACCESS_KEY などの secret は受け取らない。
 */

/**
 * @param {string} body
 * @returns {unknown[]}
 */
export function parseSseEvents(body) {
  return body.split(/\r?\n\r?\n/).flatMap((block) => {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim());
    if (dataLines.length === 0) return [];
    const data = dataLines.join('\n');
    if (!data || data === '[DONE]') return [];
    return [JSON.parse(data)];
  });
}

/**
 * @param {unknown} event
 * @returns {event is { type: string }}
 */
function hasType(event) {
  return Boolean(event && typeof event === 'object' && typeof event.type === 'string');
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * @param {readonly unknown[]} events
 * @returns {{
 *   model?: string;
 *   text: string;
 *   citations: unknown[];
 *   errors: string[];
 *   done: boolean;
 *   usage?: unknown;
 * }}
 */
export function aggregateChatEvents(events) {
  const result = {
    model: undefined,
    text: '',
    citations: [],
    errors: [],
    done: false,
    usage: undefined,
  };

  for (const event of events) {
    if (!hasType(event)) continue;
    if (event.type === 'meta' && isRecord(event) && typeof event.model === 'string') {
      result.model = event.model;
      continue;
    }
    if (event.type === 'text' && isRecord(event) && typeof event.text === 'string') {
      result.text += event.text;
      continue;
    }
    if (event.type === 'citation' && isRecord(event) && 'citation' in event) {
      result.citations.push(event.citation);
      continue;
    }
    if (event.type === 'error' && isRecord(event) && typeof event.code === 'string') {
      result.errors.push(event.code);
      continue;
    }
    if (event.type === 'done' && isRecord(event)) {
      result.done = true;
      result.usage = event.usage;
    }
  }

  return result;
}

function createCitationStats() {
  return {
    received: 0,
    accepted: 0,
    droppedInvalidBounds: 0,
    droppedTextMismatch: 0,
    droppedMissingDocument: 0,
    droppedDuplicate: 0,
  };
}

function normalizeCitation(input) {
  if (!isRecord(input)) return null;
  if (
    input.type !== 'char_location' &&
    input.type !== 'page_location' &&
    input.type !== 'content_block_location'
  ) {
    return null;
  }
  if (typeof input.cited_text !== 'string' || input.cited_text.length === 0) return null;
  if (
    typeof input.document_index !== 'number' ||
    !Number.isInteger(input.document_index) ||
    input.document_index < 0
  ) {
    return null;
  }

  return {
    type: input.type,
    cited_text: input.cited_text,
    document_index: input.document_index,
    document_title: typeof input.document_title === 'string' ? input.document_title : null,
    start_char_index: positiveIntOrUndefined(input.start_char_index),
    end_char_index: positiveIntOrUndefined(input.end_char_index),
    start_page_number: positiveIntOrUndefined(input.start_page_number),
    end_page_number: positiveIntOrUndefined(input.end_page_number),
    start_block_index: positiveIntOrUndefined(input.start_block_index),
    end_block_index: positiveIntOrUndefined(input.end_block_index),
  };
}

function positiveIntOrUndefined(value) {
  if (value === undefined) return undefined;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function hasInvalidBounds(citation, documentTexts) {
  const numberFields = [
    citation.start_char_index,
    citation.end_char_index,
    citation.start_page_number,
    citation.end_page_number,
    citation.start_block_index,
    citation.end_block_index,
  ];
  if (numberFields.some((value) => value === null)) return true;
  if (
    citation.start_char_index !== undefined &&
    citation.end_char_index !== undefined &&
    citation.end_char_index < citation.start_char_index
  ) {
    return true;
  }
  const documentText = documentTexts?.[citation.document_index];
  if (documentText === undefined) return false;
  if (citation.start_char_index !== undefined && citation.start_char_index > documentText.length) {
    return true;
  }
  if (citation.end_char_index !== undefined && citation.end_char_index > documentText.length) {
    return true;
  }
  return false;
}

function citationSignature(citation) {
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

/**
 * @param {readonly unknown[]} rawCitations
 * @param {readonly string[] | undefined} documentTexts
 * @returns {{ citations: unknown[]; stats: ReturnType<typeof createCitationStats> }}
 */
export function validateCitationBatchForEvidence(rawCitations, documentTexts) {
  const stats = createCitationStats();
  const citations = [];
  const seen = new Set();

  for (const input of rawCitations) {
    stats.received += 1;
    const citation = normalizeCitation(input);
    if (!citation || hasInvalidBounds(citation, documentTexts)) {
      stats.droppedInvalidBounds += 1;
      continue;
    }

    const documentText = documentTexts?.[citation.document_index];
    if (documentTexts && documentText === undefined) {
      stats.droppedMissingDocument += 1;
      continue;
    }
    if (documentText !== undefined && !documentText.includes(citation.cited_text)) {
      stats.droppedTextMismatch += 1;
      continue;
    }

    const key = citationSignature(citation);
    if (seen.has(key)) {
      stats.droppedDuplicate += 1;
      continue;
    }

    seen.add(key);
    citations.push(citation);
    stats.accepted += 1;
  }

  return { citations, stats };
}

/**
 * @param {{
 *   id: string;
 *   status: number;
 *   contentType: string | null;
 *   events: readonly unknown[];
 *   aggregate: ReturnType<typeof aggregateChatEvents>;
 *   documentTexts?: readonly string[];
 * }} params
 */
export function buildLiveSampleResult(params) {
  const citationValidation = validateCitationBatchForEvidence(
    params.aggregate.citations,
    params.documentTexts,
  );
  const passed =
    params.status === 200 &&
    params.aggregate.errors.length === 0 &&
    params.aggregate.done &&
    params.aggregate.text.trim().length > 0 &&
    citationValidation.stats.accepted > 0;

  return {
    id: params.id,
    passed,
    status: params.status,
    contentType: params.contentType,
    model: params.aggregate.model,
    answerText: params.aggregate.text,
    citationCount: citationValidation.stats.accepted,
    citationValidationStats: citationValidation.stats,
    citations: citationValidation.citations,
    usage: params.aggregate.usage,
    errors: params.aggregate.errors,
    eventCount: params.events.length,
  };
}
