import { defineConfig, devices } from '@playwright/test';
import { SERVER_LOG_PATH } from './e2e/authed/server-log';

// Authed E2E (VKB-101) — everything behind `middleware: 'auth'`. Needs a
// migrated Postgres; the session is minted by the real magic-link flow, read
// out of the server's console-email output (see e2e/authed/README.md).
//
// Deliberately a SECOND config, not another project in playwright.config.ts:
// the smoke suite must keep running with no infra, unconditionally, and
// sharing a config would mean sharing its webServer.
//
// Port 3100 keeps this server off 3000, where a dev server or the smoke suite
// would already be listening. That is a port courtesy, not isolation: both
// suites build into the same `.output`, so they must still be run one at a
// time locally. In CI they are separate jobs on separate runners.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `[e2e:authed] missing env: ${missing.join(', ')}. Locally run ` +
      '`bun run test:e2e:authed` (loads .env.local via scripts/with-env.js); ' +
      'in CI set them on the job.',
  );
}

// The harness resolves magic links from the console emailer. The local stage
// is a necessary condition for it — as it is for the null Redis driver and the
// non-secure session cookie this suite needs over plain http.
const stage = process.env.APP_ENV ?? 'local';
if (stage !== 'local') {
  throw new Error(
    `[e2e:authed] APP_ENV must be local (got ${stage}) — any other stage ` +
      'sends real email, so no magic link ever reaches the suite.',
  );
}

// ...but not a sufficient one: server/utils/email.ts picks Resend whenever
// BOTH credentials are present, whatever the stage. Left unchecked, that turns
// into a 20s timeout or a Resend 500 on an @example.com address, neither of
// which points at the cause.
if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
  throw new Error(
    '[e2e:authed] RESEND_API_KEY + EMAIL_FROM select the Resend driver even ' +
      'at APP_ENV=local — unset them for this suite, or the magic link is ' +
      'emailed instead of logged and no spec can read it.',
  );
}

export default defineConfig({
  testDir: './e2e/authed',
  globalSetup: './e2e/authed/global-setup.ts',
  outputDir: './test-results/authed',
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
    command: 'node node_modules/.bin/nuxt build && node scripts/e2e-server.js',
    url: baseURL,
    // Never adopt a server this config did not start: the sign-in fixture
    // reads links from the log scripts/e2e-server.js writes, and a foreign
    // dev server writes no such log.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      APP_URL: baseURL,
      NITRO_PORT: String(PORT),
      E2E_SERVER_LOG: SERVER_LOG_PATH,
    },
  },
});
