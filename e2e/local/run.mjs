import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { run as runHttp } from './poll-claim.http.mjs';
import { run as runClient } from './poll-claim.client.mjs';

// Local-only poll/claim integration runner (VKB-70). Spawns a dev server,
// captures its console-email stdout to resolve magic links, runs the HTTP and
// Playwright suites against it, then tears the server down. Requires local
// Postgres + the local env (invoke via `bun run test:poll-claim`, which runs
// `infra:up` first and loads .env.local through scripts/with-env.js). This is
// deliberately NOT a Playwright spec and NOT part of `bun run test:e2e` — CI
// has no database.

const BASE = process.env.POLL_TEST_BASE ?? 'http://localhost:3000';

const lines = [];
const capture = (buf) => {
  for (const line of buf.toString().split('\n')) {
    if (line) lines.push(line);
  }
};

const startServer = () => {
  const child = spawn('nuxt', ['dev'], {
    env: process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return child;
};

const waitHealthy = async (timeoutMs = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      // server not up yet
    }
    await sleep(500);
  }
  return false;
};

// Resolve the console-email link for an email from captured server stdout.
const findLink = async (email) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const line = [...lines]
      .reverse()
      .find((l) => l.includes(`to=${email}`) && l.includes('link='));
    if (line) return /link=(\S+)/.exec(line)[1];
    await sleep(100);
  }
  throw new Error(`no console link for ${email}`);
};

const killTree = (child) => {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // already gone
    }
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    console.error(
      '[poll-claim] DATABASE_URL not set. Run: bun run test:poll-claim',
    );
    process.exit(2);
  }

  const server = startServer();
  let failed = 1;
  try {
    if (!(await waitHealthy())) {
      console.error('[poll-claim] dev server did not become healthy in time');
      return;
    }
    console.log('\n### server invariants (HTTP) ###');
    const http = await runHttp({ base: BASE, findLink });
    console.log('\n### client cross-jar (Playwright) ###');
    const client = await runClient({ base: BASE, findLink });
    failed = http.failed + client.failed;
    console.log(
      `\n==== TOTAL: ${http.passed + client.passed} passed, ${failed} failed ====`,
    );
  } finally {
    killTree(server);
  }
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error('[poll-claim] runner crashed:', error);
  process.exit(1);
});
