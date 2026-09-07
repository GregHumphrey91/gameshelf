import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real API and database, run from the e2e container in
 * docker-compose.test.yml (`npm run test:e2e` at the repo root). The stack is started by compose, so
 * this config starts nothing itself; E2E_BASE_URL points at the web container and the entrypoint
 * has already waited for the API and web to be ready.
 */
const isCI = !!process.env.CI;
const baseURL = process.env.E2E_BASE_URL;

if (!baseURL) {
  throw new Error('E2E_BASE_URL is not set. Run the suite with `npm run test:e2e` from the repository root.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
