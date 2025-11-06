import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        timeout: 120_000,
        reuseExistingServer: true,
      },
});

