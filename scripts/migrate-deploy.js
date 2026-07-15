#!/usr/bin/env node
// Apply pending Drizzle migrations during a Vercel build, before `nuxt build`
// (wired via the `vercel-build` script). Skips — without failing — when no
// database is wired into the build env, so a DB-less build still succeeds;
// migrates when DATABASE_URL_UNPOOLED is present. drizzle-kit migrate is
// idempotent (it tracks applied migrations), so it is safe to run every deploy.
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL_UNPOOLED) {
  // Deliberately still exit 0 — a DB-less build must succeed. But this path
  // ships un-migrated code with a green build, so if the env is merely
  // MISCONFIGURED the deploy looks fine and the schema silently lags. One
  // quiet log line was not enough of a signal; make it unmissable.
  console.warn(
    '\n' +
      '!!! [migrate-deploy] DATABASE_URL_UNPOOLED is unset — NO MIGRATIONS RUN.\n' +
      '!!! Building anyway (DB-less builds are supported). If this deploy is\n' +
      '!!! supposed to have a database, the env is misconfigured and the\n' +
      '!!! schema will lag behind the code with a green build.\n',
  );
  process.exit(0);
}

console.log('[migrate-deploy] applying pending migrations...');
const result = spawnSync('drizzle-kit', ['migrate'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
