import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/codifyqr/',
    channel: 'chrome',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/codifyqr/',
    reuseExistingServer: !process.env.CI,
  },
});
