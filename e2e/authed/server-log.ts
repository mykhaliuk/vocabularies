import { resolve } from 'node:path';

// One source of truth for the mirrored server log (VKB-101):
// playwright.authed.config.ts hands this path to the server process as
// E2E_SERVER_LOG, and the sign-in fixture resolves magic links out of it.
//
// Resolved against the invocation cwd, which is the repo root for every
// supported entry point (`bun run` runs scripts from the package root; CI runs
// from the checkout). `tmp/` is gitignored.
export const SERVER_LOG_PATH = resolve(
  process.cwd(),
  'tmp/e2e-authed-server.log',
);
