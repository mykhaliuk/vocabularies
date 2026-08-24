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
// Port 3100 keeps this server off 3000 (dev server, e2e/local) and 3200 (the
// smoke suite). That is a port courtesy, not isolation: both suites build
// into the same `.output`, so they must still be run one at a time locally.
// In CI they are separate jobs on separate runners.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Presigning (server/utils/storage.ts) is a local HMAC signature over these
// values — it signs against S3_ENDPOINT, it never dials it — so minting an
// upload slot needs no reachable bucket. The authed suite deliberately runs
// with no MinIO (see e2e/authed/README.md): a spec that creates an entry
// with media never PUTs the signed URL or confirms the upload, so the media
// row stays 'processing' forever — exactly the state
// e2e/authed/entry-detail.spec.ts asserts against. Real upload + playback
// against a live bucket is e2e/local's job (VKB-115), never this suite's.
//
// Every placeholder defers to a real value first, so a local run against
// MinIO (.env.local) is unaffected — these only take over when nothing is
// set, i.e. in CI. Names and host are deliberately non-functional: `.invalid`
// is the RFC 2606 reserved TLD for addresses that must not resolve, and the
// key/secret/bucket strings say outright that they authorize nothing.
const STORAGE_PLACEHOLDER_ENV = {
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://s3.invalid',
  S3_MEDIA_ACCESS_KEY_ID:
    process.env.S3_MEDIA_ACCESS_KEY_ID ??
    'authed-suite-no-minio-placeholder-media-key',
  S3_MEDIA_SECRET_ACCESS_KEY:
    process.env.S3_MEDIA_SECRET_ACCESS_KEY ??
    'authed-suite-no-minio-placeholder-media-secret',
  S3_ORIGINALS_ACCESS_KEY_ID:
    process.env.S3_ORIGINALS_ACCESS_KEY_ID ??
    'authed-suite-no-minio-placeholder-originals-key',
  S3_ORIGINALS_SECRET_ACCESS_KEY:
    process.env.S3_ORIGINALS_SECRET_ACCESS_KEY ??
    'authed-suite-no-minio-placeholder-originals-secret',
  S3_BUCKET_MEDIA:
    process.env.S3_BUCKET_MEDIA ?? 'authed-suite-placeholder-media-bucket',
  S3_BUCKET_ORIGINALS:
    process.env.S3_BUCKET_ORIGINALS ??
    'authed-suite-placeholder-originals-bucket',
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? 'true',
};

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
  // Above Playwright's 30s default because fixture setup is billed to the test:
  // signing in spends up to 20s resolving the link and 30s reaching /feed, and
  // at the default those budgets could not run out — the test would die first,
  // reporting a generic timeout instead of the fixture's diagnostic.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Nothing sets a locale cookie before a spec does, so Accept-Language
    // picks the language the English accessible names here are written for.
    locale: 'en-US',
  },
  // Desktop AND phone (VKB-114): the product is mobile-first, so a suite
  // that only renders at 1280x720 is blind to the class of defect the
  // VKB-108 review proved it misses (a 3000px column left 12 specs green).
  // Both run rather than phone replacing desktop — dropping one would just
  // relocate the blind spot, and the extra ~2min fits the CI budget. Pixel 7
  // and not an iPhone because iPhone device presets default to webkit, which
  // CI does not install; Pixel is chromium-native mobile emulation.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node node_modules/.bin/nuxt build && node scripts/e2e-server.js',
    url: baseURL,
    // Never adopt a server this config did not start: the sign-in fixture
    // reads links from the log scripts/e2e-server.js writes, and a foreign
    // dev server writes no such log.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...STORAGE_PLACEHOLDER_ENV,
      APP_URL: baseURL,
      NITRO_PORT: String(PORT),
      E2E_SERVER_LOG: SERVER_LOG_PATH,
    },
  },
});
