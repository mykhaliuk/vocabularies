import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

// The gate's whole job is its exit code, so the probe runs the real script as
// the build would and reads that code. It runs outside the repo because the
// decision is made from the environment, and a stray .env in the working
// directory would be part of it.
const SCRIPT = new URL('../../scripts/migrate-deploy.js', import.meta.url)
  .pathname;

// `drizzle-kit migrate` is on PATH in a real build and would need a database.
// A stub stands in, so "did the gate decide to migrate?" is observable without
// one — and so a gate that wrongly skips cannot pass by staying silent.
const stubBin = mkdtempSync(join(tmpdir(), 'migrate-gate-'));
writeFileSync(
  join(stubBin, 'drizzle-kit'),
  '#!/bin/sh\necho "MIGRATE-RAN $*"\n',
);
chmodSync(join(stubBin, 'drizzle-kit'), 0o755);

const run = (env: Record<string, string>) => {
  const result = Bun.spawnSync(['node', SCRIPT], {
    cwd: tmpdir(),
    env: { PATH: `${stubBin}:${process.env.PATH ?? ''}`, ...env },
  });
  return {
    code: result.exitCode,
    out: result.stdout.toString(),
    err: result.stderr.toString(),
  };
};

describe('migration gate', () => {
  test('migrates when the database is wired', () => {
    const result = run({ DATABASE_URL_UNPOOLED: 'postgres://stub/db' });
    expect(result.out).toContain('MIGRATE-RAN migrate');
    expect(result.code).toBe(0);
  });

  test('a production build without a database fails', () => {
    const result = run({ VERCEL_ENV: 'production' });
    expect(result.code).toBe(1);
    expect(result.err).toContain('production build without a database');
    expect(result.out).not.toContain('MIGRATE-RAN');
  });

  test('a half-set pair fails — misconfigured, not database-less', () => {
    const result = run({ DATABASE_URL: 'postgres://stub/db' });
    expect(result.code).toBe(1);
    expect(result.err).toContain('DATABASE_URL is set');
  });

  test('an opt-in preview with no env at all still builds', () => {
    const result = run({ VERCEL_ENV: 'preview' });
    expect(result.code).toBe(0);
    expect(result.out).toContain('no database here');
    expect(result.out).not.toContain('MIGRATE-RAN');
  });

  test('SKIP_MIGRATIONS overrides even a production build', () => {
    const result = run({ SKIP_MIGRATIONS: '1', VERCEL_ENV: 'production' });
    expect(result.code).toBe(0);
    expect(result.out).toContain('by declaration');
    expect(result.out).not.toContain('MIGRATE-RAN');
  });

  test("SKIP_MIGRATIONS is a declaration, so only '1' counts", () => {
    const result = run({ SKIP_MIGRATIONS: 'false', VERCEL_ENV: 'production' });
    expect(result.code).toBe(1);
  });

  test('a failing migration fails the build', () => {
    const failingBin = mkdtempSync(join(tmpdir(), 'migrate-gate-fail-'));
    writeFileSync(join(failingBin, 'drizzle-kit'), '#!/bin/sh\nexit 3\n');
    chmodSync(join(failingBin, 'drizzle-kit'), 0o755);
    const result = Bun.spawnSync(['node', SCRIPT], {
      cwd: tmpdir(),
      env: {
        PATH: `${failingBin}:${process.env.PATH ?? ''}`,
        DATABASE_URL_UNPOOLED: 'postgres://stub/db',
      },
    });
    expect(result.exitCode).toBe(3);
  });
});
