#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DEV_URL = process.env.DATABASE_URL_UNPOOLED;
if (!DEV_URL) {
  console.error(
    '[db-dump-dev] DATABASE_URL_UNPOOLED missing — run via `node scripts/with-env.js dev …`',
  );
  process.exit(2);
}

const localEnvPath = resolve(process.cwd(), '.env.local');
if (!existsSync(localEnvPath)) {
  console.error(`[db-dump-dev] .env.local not found at ${localEnvPath}`);
  process.exit(2);
}

const localText = readFileSync(localEnvPath, 'utf8');
let LOCAL_URL = '';
for (const rawLine of localText.split('\n')) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  if (line.slice(0, eq).trim() !== 'DATABASE_URL_UNPOOLED') continue;
  let value = line.slice(eq + 1).trim();
  const quoted =
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
  if (quoted) {
    LOCAL_URL = value.slice(1, -1);
  } else {
    const inlineComment = value.search(/\s#/);
    if (inlineComment !== -1) value = value.slice(0, inlineComment).trim();
    LOCAL_URL = value;
  }
  break;
}
if (!LOCAL_URL) {
  console.error('[db-dump-dev] DATABASE_URL_UNPOOLED missing in .env.local');
  process.exit(2);
}

let localHost;
try {
  localHost = new URL(LOCAL_URL).hostname;
} catch {
  console.error(
    '[db-dump-dev] refusing: .env.local DATABASE_URL_UNPOOLED is not a valid URL',
  );
  process.exit(2);
}
if (localHost !== 'localhost' && localHost !== '127.0.0.1') {
  console.error(
    `[db-dump-dev] refusing: .env.local DATABASE_URL_UNPOOLED host is ${localHost}, expected localhost. ` +
      'This script overwrites the target schema and must only target a local database.',
  );
  process.exit(2);
}

let devHost;
try {
  devHost = new URL(DEV_URL).hostname;
} catch {
  console.error(
    '[db-dump-dev] refusing: DATABASE_URL_UNPOOLED is not a valid URL',
  );
  process.exit(2);
}
console.log(`[db-dump-dev] source=${devHost} target=${localHost}`);

const dumpFile = join(
  tmpdir(),
  `vocabu-dev-dump-${process.pid}-${Date.now()}.sql`,
);
let cleanupNeeded = true;
const cleanup = () => {
  if (!cleanupNeeded) return;
  cleanupNeeded = false;
  try {
    rmSync(dumpFile, { force: true });
  } catch (err) {
    console.error('[db-dump-dev] cleanup failed', err);
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
process.on('SIGHUP', () => process.exit(129));

try {
  console.log(
    `[db-dump-dev] pg_dump dev → ${dumpFile} (via docker postgres container to match server version)`,
  );
  const dump = spawn(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'pg_dump',
      '--no-owner',
      '--no-acl',
      '--clean',
      '--if-exists',
      '--file=/dev/stdout',
      DEV_URL,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  if (!dump.stdout) throw new Error('pg_dump pipeline missing stdout');
  const { createWriteStream } = await import('node:fs');
  const { pipeline } = await import('node:stream/promises');
  await Promise.all([
    pipeline(dump.stdout, createWriteStream(dumpFile)),
    new Promise((res, rej) => {
      dump.on('error', (err) => {
        rej(new Error(`pg_dump failed to spawn: ${err.message}`));
      });
      dump.on('exit', (code, signal) => {
        if (code === 0) res(undefined);
        else rej(new Error(`pg_dump exited code=${code} signal=${signal}`));
      });
    }),
  ]);

  console.log('[db-dump-dev] resetting local public schema');
  const reset = spawnSync(
    'psql',
    [
      LOCAL_URL,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    ],
    { stdio: 'inherit' },
  );
  if (reset.status !== 0) {
    throw new Error(`psql schema reset exited ${reset.status}`);
  }

  console.log('[db-dump-dev] psql restore from dump file');
  const restore = spawnSync(
    'psql',
    [LOCAL_URL, '-v', 'ON_ERROR_STOP=1', '-f', dumpFile],
    { stdio: 'inherit' },
  );
  if (restore.status !== 0) {
    throw new Error(`psql restore exited ${restore.status}`);
  }

  console.log('[db-dump-dev] sanity check: select count(*) from users');
  const sanity = spawnSync(
    'psql',
    [LOCAL_URL, '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT count(*) FROM users'],
    { stdio: 'inherit' },
  );
  if (sanity.status !== 0) {
    throw new Error(`sanity check exited ${sanity.status}`);
  }

  console.log('[db-dump-dev] done');
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[db-dump-dev] ${message}`);
  console.error(
    '[db-dump-dev] hint: ensure docker compose stack is running (`bun run infra:up`) and `psql` is on PATH',
  );
  process.exit(1);
}
