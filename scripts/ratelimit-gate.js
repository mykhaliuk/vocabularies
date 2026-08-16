#!/usr/bin/env node
// Refuse to build a deploy that has a database but no rate limiter, before
// `nuxt build` (wired via the `vercel-build` script).
//
// Same reasoning as the migration gate, and the same signal: an environment
// that carries DATABASE_URL_UNPOOLED is a configured stage, and every
// configured stage requires rate limiting (server/utils/ratelimit.ts throws
// for any APP_ENV other than local). An opt-in preview carries no runtime env
// at all and is not expected to have either. See ADR-0018.

const REQUIRED_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];

const skipRequested = process.env.SKIP_RATELIMIT_GATE === '1';
const isConfiguredStage =
  Boolean(process.env.DATABASE_URL_UNPOOLED) ||
  process.env.VERCEL_ENV === 'production';

if (skipRequested) {
  console.log(
    '[ratelimit-gate] SKIP_RATELIMIT_GATE=1 — skipping by declaration.',
  );
  process.exit(0);
}

if (!isConfiguredStage) {
  console.log(
    '[ratelimit-gate] no database in this environment — nothing to check.',
  );
  process.exit(0);
}

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\n[ratelimit-gate] REFUSING TO BUILD: ${missing.join(' and ')} missing\n` +
      '\n' +
      'This environment has a database, so it is a configured stage, and\n' +
      'rate limiting is required there. Shipping now would run the stage\n' +
      'with abuse control at zero — permanently, and with no signal.\n' +
      '\n' +
      'Set the Upstash variables, or declare the omission with\n' +
      'SKIP_RATELIMIT_GATE=1.\n',
  );
  process.exit(1);
}

console.log('[ratelimit-gate] rate limiting is configured ✓');
