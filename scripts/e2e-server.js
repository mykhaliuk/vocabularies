#!/usr/bin/env node
/* Run the built app for the authed e2e suite and MIRROR its output to a file.

   The mirror is the whole point. In the `local` stage the emailer prints
   magic links to stdout (server/utils/email.ts), but a Playwright spec cannot
   read the output of a server Playwright itself spawned. Teeing that output to
   a file gives the sign-in fixture somewhere to resolve links from — with no
   test-only backdoor in the app and no second email driver.

   Started by playwright.authed.config.ts as its webServer command, after
   `nuxt build`. The log path arrives as E2E_SERVER_LOG.

   `.output/server/index.mjs` is launched directly instead of `nuxt preview`:
   preview spawns that same file as a grandchild, and one less process between
   the server and this pipe is one less way for a magic link to go missing.
*/
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const logPath = process.env.E2E_SERVER_LOG;
if (!logPath) {
  console.error('[e2e-server] E2E_SERVER_LOG is required');
  process.exit(2);
}

const entry = resolve(process.cwd(), '.output/server/index.mjs');
if (!existsSync(entry)) {
  console.error(`[e2e-server] no build output at ${entry} — run nuxt build`);
  process.exit(2);
}

mkdirSync(dirname(logPath), { recursive: true });
// Truncate: a link left by an earlier run must never satisfy a fixture.
const log = createWriteStream(logPath, { flags: 'w' });

const child = spawn(process.execPath, [entry], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

// A stream 'error' with no listener is thrown, which would kill this wrapper
// mid-suite and leave Playwright reporting "Process from config.webServer
// exited early" — a message pointing nowhere near the cause. EPIPE is the
// expected one: Playwright closes our stdout during teardown.
const watch = (stream, label) => {
  stream.on('error', (error) => {
    if (error.code === 'EPIPE') return;
    console.error(`[e2e-server] ${label} stream failed:`, error);
  });
};

watch(log, 'log');
watch(process.stdout, 'stdout');
watch(process.stderr, 'stderr');

const mirror = (source, target) => {
  source.on('data', (chunk) => {
    target.write(chunk);
    log.write(chunk);
  });
};

mirror(child.stdout, process.stdout);
mirror(child.stderr, process.stderr);

const forward = (signal) => () => {
  child.kill(signal);
};

// Re-raising a signal only kills this process once its own handler is gone —
// otherwise the kill below re-enters forward() and the process exits 0,
// reporting a clean shutdown for one it never performed.
const reraise = (signal) => {
  process.removeAllListeners(signal);
  process.kill(process.pid, signal);
};

process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));

// This wrapper outlives the suite, so it owes the process-level handlers any
// long-lived process does. State is corrupt after an uncaught exception —
// take the server down with us rather than serving from it.
process.on('uncaughtException', (error) => {
  console.error('[e2e-server] uncaught exception:', error);
  child.kill('SIGTERM');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[e2e-server] unhandled rejection:', reason);
});

child.on('error', (error) => {
  console.error('[e2e-server] failed to start the server:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  log.end();
  if (signal) reraise(signal);
  else process.exit(code ?? 1);
});
