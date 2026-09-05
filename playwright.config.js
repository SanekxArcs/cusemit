import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  testDir: './tests',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { channel: 'chrome' },
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
});
