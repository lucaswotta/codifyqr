import { defineConfig } from '@playwright/test';

// Set CODIFYQR_E2E_URL (ending with a slash) to run the suite against a deployed site instead of a local build.
const remote = process.env.CODIFYQR_E2E_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: remote ?? 'http://localhost:4173/codifyqr/',
    channel: 'chrome',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: remote
    ? undefined
    : {
        command: 'pnpm exec vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173/codifyqr/',
        reuseExistingServer: !process.env.CI,
      },
});
