#!/usr/bin/env node
// Apply pending Drizzle migrations during a Vercel build, before `nuxt build`
// (wired via the `vercel-build` script). Skips — without failing — when no
// database is wired into the build env, so a DB-less build still succeeds;
// migrates when DATABASE_URL_UNPOOLED is present. drizzle-kit migrate is
// idempotent (it tracks applied migrations), so it is safe to run every deploy.
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.log('[migrate-deploy] DATABASE_URL_UNPOOLED unset — skipping');
  process.exit(0);
}

console.log('[migrate-deploy] applying pending migrations...');
const result = spawnSync('drizzle-kit', ['migrate'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
