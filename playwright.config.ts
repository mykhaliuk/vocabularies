import { defineConfig, devices } from '@playwright/test';

// Smoke E2E against a production preview (build + preview) — clean, fast
// hydration, no dev HMR races. The covered routes (landing, login, offline,
// 404) render without DB/Redis/email, so CI needs no infra, and this suite
// stays that way on purpose. Anything needing a session goes to the authed
// suite instead: playwright.authed.config.ts (VKB-101).
//
// Port 3200 keeps the suite off 3000 (dev server, e2e/local) and 3100 (authed
// suite), and reuse is off by default (VKB-146): a run that adopts whatever
// already listens reports on that server, not on the branch. Iterating on
// specs against a preview you already built is the one sanctioned exception —
// opt in with E2E_REUSE_SERVER=1, and the run says so out loud.
const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

const reuseServer = process.env.E2E_REUSE_SERVER === '1';
if (reuseServer) {
  console.warn(
    `[e2e] E2E_REUSE_SERVER=1 — adopting any server already on ${baseURL}; ` +
      'this run does NOT build the branch.',
  );
}

export default defineConfig({
  testDir: './e2e',
  // Both subtrees are DB-backed and belong to their own runners: e2e/local/*
  // to `bun run test:poll-claim`, e2e/authed/* to `bun run test:e2e:authed`.
  // This suite must stay infra-free, so neither may be collected here — the
  // whole directory is testDir, and an unignored subtree lands in it.
  testIgnore: ['**/local/**', '**/authed/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Accept-Language decides the locale on a first visit with no cookie, so
    // without this the English cases fail on a French or Ukrainian machine.
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'node node_modules/.bin/nuxt build && node node_modules/.bin/nuxt preview',
    url: baseURL,
    reuseExistingServer: reuseServer,
    timeout: 180_000,
    env: { APP_URL: baseURL, NITRO_PORT: String(PORT), PORT: String(PORT) },
  },
});
