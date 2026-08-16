import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

// Same probe shape as the migration gate: the script's exit code is its whole
// contract, so run the real thing. Outside the repo, because the decision is
// made from the environment and a stray .env would be part of it.
const SCRIPT = fileURLToPath(
  new URL('../../scripts/ratelimit-gate.js', import.meta.url),
);

const UPSTASH = {
  UPSTASH_REDIS_REST_URL: 'https://stub.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'stub-token',
};

const run = (env: Record<string, string>) => {
  const result = Bun.spawnSync(['node', SCRIPT], {
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  return {
    code: result.exitCode,
    out: result.stdout.toString(),
    err: result.stderr.toString(),
  };
};

describe('rate-limit config gate', () => {
  test('a configured stage with both variables passes', () => {
    const result = run({
      DATABASE_URL_UNPOOLED: 'postgres://stub/db',
      ...UPSTASH,
    });
    expect(result.code).toBe(0);
    expect(result.out).toContain('rate limiting is configured');
  });

  test('a stage with a database but no limiter fails', () => {
    const result = run({ DATABASE_URL_UNPOOLED: 'postgres://stub/db' });
    expect(result.code).toBe(1);
    expect(result.err).toContain('UPSTASH_REDIS_REST_URL');
    expect(result.err).toContain('UPSTASH_REDIS_REST_TOKEN');
  });

  test('a half-set Upstash pair fails and names the missing half', () => {
    const result = run({
      DATABASE_URL_UNPOOLED: 'postgres://stub/db',
      UPSTASH_REDIS_REST_URL: 'https://stub.upstash.io',
    });
    expect(result.code).toBe(1);
    expect(result.err).toContain('UPSTASH_REDIS_REST_TOKEN missing');
  });

  test('production is a configured stage even with no database URL', () => {
    const result = run({ VERCEL_ENV: 'production' });
    expect(result.code).toBe(1);
  });

  test('an opt-in preview with no env at all still builds', () => {
    const result = run({ VERCEL_ENV: 'preview' });
    expect(result.code).toBe(0);
    expect(result.out).toContain('nothing to check');
  });

  test('SKIP_RATELIMIT_GATE overrides a configured stage', () => {
    const result = run({
      SKIP_RATELIMIT_GATE: '1',
      DATABASE_URL_UNPOOLED: 'postgres://stub/db',
    });
    expect(result.code).toBe(0);
    expect(result.out).toContain('by declaration');
  });
});

// Both build gates answer "is this a configured stage?" from the same env
// shape, in two files (ADR-0017, ADR-0018). Nothing forces the two copies to
// agree, so this asserts it instead of trusting a cross-reference comment: a
// change to one gate's notion of "configured" fails here rather than silently
// leaving the other gate guarding a different set of deploys.
const MIGRATE_GATE = fileURLToPath(
  new URL('../../scripts/migrate-deploy.js', import.meta.url),
);

const migrateTreatsAsConfigured = (env: Record<string, string>) => {
  const result = Bun.spawnSync(['node', MIGRATE_GATE], {
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  return !result.stdout.toString().includes('no database here');
};

const ratelimitTreatsAsConfigured = (env: Record<string, string>) =>
  !run(env).out.includes('nothing to check');

describe('the two build gates agree on what a configured stage is', () => {
  const CASES: Array<[string, Record<string, string>]> = [
    ['opt-in preview, no env at all', { VERCEL_ENV: 'preview' }],
    ['production', { VERCEL_ENV: 'production' }],
    ['a stage with a database', { DATABASE_URL_UNPOOLED: 'postgres://s/d' }],
  ];

  for (const [name, env] of CASES) {
    test(name, () => {
      expect(ratelimitTreatsAsConfigured(env)).toBe(
        migrateTreatsAsConfigured(env),
      );
    });
  }
});
