import { defineConfig, devices } from '@playwright/test';

// Smoke E2E against a production preview (build + preview) — clean, fast
// hydration, no dev HMR races. The covered routes (landing, login, offline,
// 404) render without DB/Redis/email, so CI needs no infra.
const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // e2e/local/* are DB-backed poll/claim integration tests run by their own
  // runner (`bun run test:poll-claim`), never by this CI suite — CI has no
  // database. Ignore them so `playwright test` cannot collect them.
  testIgnore: '**/local/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'node node_modules/.bin/nuxt build && node node_modules/.bin/nuxt preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
