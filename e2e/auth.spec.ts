import { expect, test } from '@playwright/test';

// playwright.config.ts の webServer.env で注入しているテスト専用キー。
// 本番や .env.local のキーとは独立している。
const E2E_PASSWORD = 'test-password-for-e2e';

test.describe('認証ゲート', () => {
  test('正しいアクセスキーを入力するとメインUIが表示される', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByPlaceholder('アクセスキー')).toBeVisible();

    await page.getByPlaceholder('アクセスキー').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: '開く' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'citation-reader' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible();
  });

  test('誤ったアクセスキーを入力するとエラー表示されメインUIには進めない', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('アクセスキー').fill('wrong-password');
    await page.getByRole('button', { name: '開く' }).click();

    await expect(page.getByText('アクセスキーが正しくありません。')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログアウト' })).not.toBeVisible();
  });

  test('アクセスキー未入力では送信ボタンが無効化されている', async ({ page }) => {
    await page.goto('/');

    const submit = page.getByRole('button', { name: '開く' });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder('アクセスキー').fill('x');
    await expect(submit).toBeEnabled();
  });
});
