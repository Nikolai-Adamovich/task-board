import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for the Task Board UI.
 *
 * Tests assume the Angular dev server is running on port 4200
 * and the backend API is running on port 8787.
 *
 * Run with: npx playwright test
 * Run headed: npx playwright test --headed
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Start the dev server before running tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:4200',
  //   reuseExistingServer: !process.env['CI'],
  //   timeout: 120_000,
  // },
});
