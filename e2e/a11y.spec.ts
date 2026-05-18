import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const E2E_PASSWORD = 'test-password-for-e2e';

interface AxeViolationLite {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: { target: string; failureSummary?: string }[];
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('アクセスキー').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'citation-reader' })).toBeVisible();
}

function sseBody(events: readonly Record<string, unknown>[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

async function mockChatWithCitation(page: Page) {
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
}

async function scanBlockingViolations(page: Page): Promise<AxeViolationLite[]> {
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze();
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: Array.isArray(n.target) ? n.target.join(' >> ') : String(n.target),
        failureSummary: n.failureSummary ?? undefined,
      })),
    }));
}

test.describe('axe-core 自動 a11y 検査', () => {
  test('login 画面に critical/serious 違反なし', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('アクセスキー')).toBeVisible();
    const blocking = await scanBlockingViolations(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('認証後の空状態に critical/serious 違反なし', async ({ page }) => {
    await login(page);
    await expect(page.getByLabel('ドキュメント')).toBeVisible();
    const blocking = await scanBlockingViolations(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('回答と引用表示状態に critical/serious 違反なし', async ({ page }) => {
    await mockChatWithCitation(page);
    await login(page);
    await page.getByRole('button', { name: 'サンプル読込' }).click();
    await page.getByRole('button', { name: '質問する' }).click();
    await expect(page.getByText('これはサンプル要約のテストです。')).toBeVisible();
    await expect(page.getByRole('button', { name: /引用元 1:/ }).first()).toBeVisible();

    const blocking = await scanBlockingViolations(page);
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
