import { defineConfig, devices } from '@playwright/test';

// Smoke E2E against a production preview (build + preview) — clean, fast
// hydration, no dev HMR races. The covered routes (landing, login, offline,
// 404) render without DB/Redis/email, so CI needs no infra, and this suite
// stays that way on purpose. Anything needing a session goes to the authed
// suite instead: playwright.authed.config.ts (VKB-101).
const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Both subtrees are DB-backed and belong to their own runners: e2e/local/*
  // to `bun run test:poll-claim`, e2e/authed/* to `bun run test:e2e:authed`.
  // This suite must stay infra-free, so neither may be collected here — the
  // whole directory is testDir, and an uningnored subtree lands in it.
  testIgnore: ['**/local/**', '**/authed/**'],
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
