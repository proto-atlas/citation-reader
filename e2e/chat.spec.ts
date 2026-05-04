import { expect, test, type Page } from '@playwright/test';

const E2E_PASSWORD = 'test-password-for-e2e';

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('アクセスキー').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'citation-reader' })).toBeVisible();
}

/** SSE 形式のテキスト本体を組み立てる。 */
function sseBody(events: readonly Record<string, unknown>[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

test.describe('チャット (SSE モック)', () => {
  test('サンプル読込 → 質問する → 回答 + 引用バッジ表示 → クリックで原文プレビュー', async ({
    page,
  }) => {
    // /api/chat を Playwright route() でモック。実 Anthropic API を叩かず課金させない。
    await page.route('**/api/chat', async (route) => {
      const body = sseBody([
        { type: 'meta', model: 'claude-haiku-4-5-20251001' },
        { type: 'text', index: 0, text: 'これはサンプル要約のテストです。' },
        {
          type: 'citation',
          index: 0,
          citation: {
            type: 'char_location',
            cited_text: 'エッジコンピューティング',
            document_index: 0,
            start_char_index: 0,
            end_char_index: 12,
          },
        },
        { type: 'done', usage: { input_tokens: 100, output_tokens: 30 } },
      ]);
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body,
      });
    });

    await login(page);

    // サンプル読込ボタン (textarea にサンプル文字列が流し込まれる)
    await page.getByRole('button', { name: 'サンプル読込' }).click();
    // textarea に「エッジコンピューティング」で始まる本文が入っていることを確認
    await expect(page.getByLabel('ドキュメント')).toContainText('エッジコンピューティング');

    // 質問は空欄のまま (デフォルト要約) で送信
    await page.getByRole('button', { name: '質問する' }).click();

    // モック応答の text が表示される
    await expect(page.getByText('これはサンプル要約のテストです。')).toBeVisible();

    // 引用バッジ (button、aria-label に番号 + 引用テキスト)
    const citationBadge = page.getByRole('button', { name: /引用元 1:/ }).first();
    await expect(citationBadge).toBeVisible();

    // 引用バッジをクリック → SourceViewer が表示される
    await citationBadge.click();
    await expect(page.getByRole('heading', { name: '引用元プレビュー' })).toBeVisible();
    // 原文の該当箇所がハイライトされる (cited_text を含む emerald 背景の span)
    // visible な textarea / SourceViewer 内の cited_text がレンダされている
    await expect(page.locator('text=エッジコンピューティング').first()).toBeVisible();
  });

  test('ステータス 429 → 「短時間に多くのリクエスト」エラー文言が表示される', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'rate_limit', retryAfterSeconds: 30 }),
        headers: { 'Retry-After': '30' },
      });
    });

    await login(page);
    await page.getByRole('button', { name: 'サンプル読込' }).click();
    await page.getByRole('button', { name: '質問する' }).click();

    // ERROR_LABELS['rate_limit'] の文言
    await expect(page.getByText(/短時間に多くのリクエスト/)).toBeVisible();
  });
});
