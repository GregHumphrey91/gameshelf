import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real API and database. Two ways to run:
 *
 * 1. `npm run test:e2e` (repo root) — Playwright starts both servers itself and reuses them if they are
 *    already running locally:
 *      API  — `dotnet run` on :8080, ready when /health/ready returns 200 (i.e. the database is up)
 *      Web  — Vite dev server on :5173
 *    Only the SQL Server container is assumed to exist (`npm run db:up`). In CI the API's connection
 *    string comes from the environment (ConnectionStrings__GameShelf).
 *
 * 2. Against an already-running stack — set E2E_BASE_URL and Playwright starts nothing. This is how
 *    `npm run test:docker:e2e` works: the e2e container targets the web and api containers.
 */
const isCI = !!process.env.CI;
const externalStack = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalStack ? undefined : [
    {
      command: 'dotnet run --project ../GameShelf.Api --no-launch-profile --urls http://localhost:8080',
      url: 'http://localhost:8080/health/ready',
      reuseExistingServer: !isCI,
      timeout: 240_000, // cold restore + build on a CI runner
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        Database__MigrateOnStartup: 'true',
        Cors__AllowedOrigins__0: 'http://localhost:5173',
        // E2E runs in local mode: no identity provider, every caller is a local Curator.
        Auth__Enabled: 'false',
      },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
