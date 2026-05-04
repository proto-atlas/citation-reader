import { describe, expect, it } from 'vitest';
import { validateCitationBatch, toCitationLocation } from './citations';

describe('toCitationLocation', () => {
  it('null / undefined / 文字列 / number など object でない値で null を返す', () => {
    expect(toCitationLocation(null)).toBeNull();
    expect(toCitationLocation(undefined)).toBeNull();
    expect(toCitationLocation('citation')).toBeNull();
    expect(toCitationLocation(42)).toBeNull();
  });

  it('type が想定外で null を返す', () => {
    expect(
      toCitationLocation({
        type: 'unknown_location',
        cited_text: 'hello',
        document_index: 0,
      }),
    ).toBeNull();
  });

  it('cited_text が文字列でない場合 null を返す', () => {
    expect(
      toCitationLocation({
        type: 'char_location',
        cited_text: 42,
        document_index: 0,
      }),
    ).toBeNull();
  });

  it('document_index が integer でない場合 null を返す', () => {
    expect(
      toCitationLocation({
        type: 'char_location',
        cited_text: 'hello',
        document_index: 1.5,
      }),
    ).toBeNull();
  });

  it('document_index が負の数なら null を返す', () => {
    expect(
      toCitationLocation({
        type: 'char_location',
        cited_text: 'hello',
        document_index: -1,
      }),
    ).toBeNull();
  });

  it('char_location の最小フォーマットを受理する', () => {
    const result = toCitationLocation({
      type: 'char_location',
      cited_text: 'hello',
      document_index: 0,
      start_char_index: 10,
      end_char_index: 20,
    });
    expect(result).toEqual({
      type: 'char_location',
      cited_text: 'hello',
      document_index: 0,
      document_title: undefined,
      start_char_index: 10,
      end_char_index: 20,
      start_page_number: undefined,
      end_page_number: undefined,
      start_block_index: undefined,
      end_block_index: undefined,
    });
  });

  it('page_location を受理する', () => {
    const result = toCitationLocation({
      type: 'page_location',
      cited_text: '本文',
      document_index: 0,
      document_title: 'ドキュメント',
      start_page_number: 1,
      end_page_number: 2,
    });
    expect(result?.type).toBe('page_location');
    expect(result?.start_page_number).toBe(1);
    expect(result?.end_page_number).toBe(2);
    expect(result?.document_title).toBe('ドキュメント');
  });

  it('content_block_location を受理する', () => {
    const result = toCitationLocation({
      type: 'content_block_location',
      cited_text: 'block',
      document_index: 1,
      start_block_index: 3,
      end_block_index: 4,
    });
    expect(result?.type).toBe('content_block_location');
    expect(result?.start_block_index).toBe(3);
  });

  it('start_char_index が負の数なら null を返す (validation)', () => {
    expect(
      toCitationLocation({
        type: 'char_location',
        cited_text: 'hello',
        document_index: 0,
        start_char_index: -1,
      }),
    ).toBeNull();
  });

  it('document_title が null の場合は null を保持する (Anthropic SDK の互換性)', () => {
    const result = toCitationLocation({
      type: 'char_location',
      cited_text: 'hello',
      document_index: 0,
      document_title: null,
    });
    expect(result?.document_title).toBeNull();
  });

  it('未知の追加プロパティが混入しても受理する (forward compat)', () => {
    const result = toCitationLocation({
      type: 'char_location',
      cited_text: 'hello',
      document_index: 0,
      future_field: 'ignored',
    });
    expect(result).not.toBeNull();
  });
});

describe('validateCitationBatch', () => {
  it('正常なcitationをacceptedに集計する', () => {
    const result = validateCitationBatch(
      [
        {
          type: 'char_location',
          cited_text: '根拠文',
          document_index: 0,
          start_char_index: 0,
          end_char_index: 3,
        },
      ],
      { documentTexts: ['根拠文を含む本文'] },
    );
    expect(result.stats).toEqual({
      received: 1,
      accepted: 1,
      droppedInvalidBounds: 0,
      droppedTextMismatch: 0,
      droppedMissingDocument: 0,
      droppedDuplicate: 0,
    });
  });

  it('不正なpayloadをdroppedInvalidBoundsに分類する', () => {
    const result = validateCitationBatch([
      { type: 'char_location', cited_text: 42, document_index: 0 },
    ]);
    expect(result.stats.droppedInvalidBounds).toBe(1);
  });

  it('存在しないdocument_indexをdroppedMissingDocumentに分類する', () => {
    const result = validateCitationBatch(
      [{ type: 'char_location', cited_text: '根拠文', document_index: 1 }],
      { documentTexts: ['根拠文を含む本文'] },
    );
    expect(result.stats.droppedMissingDocument).toBe(1);
  });

  it('本文に含まれないcited_textをdroppedTextMismatchに分類する', () => {
    const result = validateCitationBatch(
      [{ type: 'char_location', cited_text: '別文書の根拠', document_index: 0 }],
      { documentTexts: ['根拠文を含む本文'] },
    );
    expect(result.stats.droppedTextMismatch).toBe(1);
  });

  it('重複citationをdroppedDuplicateに分類する', () => {
    const citation = {
      type: 'char_location',
      cited_text: '根拠文',
      document_index: 0,
      start_char_index: 0,
      end_char_index: 3,
    };
    const result = validateCitationBatch([citation, citation], {
      documentTexts: ['根拠文を含む本文'],
    });
    expect(result.stats.droppedDuplicate).toBe(1);
  });

  it('文書長を超えるchar範囲をdroppedInvalidBoundsに分類する', () => {
    const result = validateCitationBatch(
      [
        {
          type: 'char_location',
          cited_text: '根拠文',
          document_index: 0,
          start_char_index: 0,
          end_char_index: 99,
        },
      ],
      { documentTexts: ['根拠文'] },
    );
    expect(result.stats.droppedInvalidBounds).toBe(1);
  });
});
