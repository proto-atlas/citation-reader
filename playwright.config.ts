import { defineConfig, devices } from '@playwright/test';

// citation-reader 専用 port (3210)。
// localhost:3000 を別プロジェクトの dev server が
// 占有していると Playwright が `reuseExistingServer` で誤接続して 5 件 fail」
// が観測されたため、port を 3210 (CitatioN_Reader の語呂) に変更して衝突を回避。
// 環境変数 PORT で上書き可能 (CI で別 port を割り当てたい場合に対応)。
const PORT = Number(process.env.PORT ?? 3210);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    // -p で port を強制し、別プロジェクトの dev server (3000) と衝突しないようにする。
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // E2E 専用のアクセスキーを注入する。.env.local の値には依存しない
    // (CI や他人のローカル環境でも同じ値でテストが動くように)。
    env: {
      ACCESS_PASSWORD: 'test-password-for-e2e',
    },
  },
});
