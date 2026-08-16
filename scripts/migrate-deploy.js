#!/usr/bin/env node
// Apply pending Drizzle migrations during a Vercel build, before `nuxt build`
// (wired via the `vercel-build` script). drizzle-kit migrate is idempotent (it
// tracks applied migrations), so it is safe to run every deploy.
//
// A build with no database must still succeed — opt-in previews of ordinary
// branches get no runtime env at all (VKB-46, see scripts/vercel-ignore.js).
// The rule below tells that apart from an environment that SHOULD have a
// database and lost the variable; see docs/adr/0017-migration-gate.md.
import { spawnSync } from 'node:child_process';

const skipRequested = process.env.SKIP_MIGRATIONS === '1';
const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;
const pooledUrl = process.env.DATABASE_URL;
const isProduction = process.env.VERCEL_ENV === 'production';

const fail = (reason) => {
  console.error(
    `\n[migrate-deploy] REFUSING TO BUILD: ${reason}\n` +
      '\n' +
      'Shipping now would put un-migrated code on a green build, and the\n' +
      'schema gap would surface as a runtime error on the first request\n' +
      'rather than here.\n' +
      '\n' +
      'Fix the environment (set DATABASE_URL_UNPOOLED), or declare the\n' +
      'build database-less on purpose with SKIP_MIGRATIONS=1.\n',
  );
  process.exit(1);
};

if (skipRequested) {
  console.log('[migrate-deploy] SKIP_MIGRATIONS=1 — skipping by declaration.');
  process.exit(0);
}

if (!unpooledUrl) {
  if (isProduction) fail('production build without a database');
  if (pooledUrl) fail('DATABASE_URL is set but DATABASE_URL_UNPOOLED is not');

  console.log(
    '[migrate-deploy] no database here — skipping migrations.\n' +
      '[migrate-deploy] (an opt-in preview builds without runtime env; a\n' +
      '[migrate-deploy] production build or a half-set pair would fail.)',
  );
  process.exit(0);
}

console.log('[migrate-deploy] applying pending migrations...');
const result = spawnSync('drizzle-kit', ['migrate'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
