import { defineConfig, devices } from '@playwright/test';

// citation-reader専用port (3210)。
// localhost:3000 を別プロジェクトのdev serverが
// 占有しているとPlaywrightが `reuseExistingServer` で誤接続して 5 件fail」
// が観測されたため、portを 3210 (CitatioN_Readerの語呂) に変更して衝突を回避。
// 環境変数PORTで上書き可能 (CIで別portを割り当てたい場合に対応)。
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
    // -pでportを強制し、別プロジェクトのdev server (3000) と衝突しないようにする。
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // E2E専用のアクセスキーを注入する。.env.localの値には依存しない
    // (CIや他人のローカル環境でも同じ値でテストが動くように)。
    env: {
      ACCESS_PASSWORD: 'test-password-for-e2e',
    },
  },
});
