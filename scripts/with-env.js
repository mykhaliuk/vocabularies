#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [stage, bin, ...args] = process.argv.slice(2);

if (!stage || !bin) {
  console.error('Usage: with-env <stage> <command> [args...]');
  process.exit(2);
}

const envPath = resolve(process.cwd(), `.env.${stage}`);
if (!existsSync(envPath)) {
  console.error(`[with-env] env file not found: ${envPath}`);
  process.exit(2);
}

const env = { ...process.env };
const text = readFileSync(envPath, 'utf8');
let loaded = 0;
let skipped = 0;

const lines = text.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line.startsWith('#')) continue;

  const eq = line.indexOf('=');
  if (eq === -1) {
    console.warn(
      `[with-env] ${envPath}:${i + 1} skipped (no '=' in non-comment line): ${line}`,
    );
    skipped++;
    continue;
  }

  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();

  const quoted =
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2);

  if (quoted) {
    value = value.slice(1, -1);
  } else {
    const inlineComment = value.search(/\s#/);
    if (inlineComment !== -1) value = value.slice(0, inlineComment).trim();
  }

  env[key] = value;
  loaded++;
}

const binDir = resolve(process.cwd(), 'node_modules/.bin');
const sep = process.platform === 'win32' ? ';' : ':';
env.PATH = `${binDir}${sep}${env.PATH ?? ''}`;

console.log(
  `[with-env] stage=${stage} loaded=${loaded}${skipped ? ` skipped=${skipped}` : ''}`,
);

const child = spawn(bin, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
