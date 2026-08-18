import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const SCRIPT = fileURLToPath(
  new URL('../../scripts/r2-cors-set.js', import.meta.url),
);

// Complete, so a refusal is the stage guard and not the missing-vars check.
const COMPLETE_ENV = {
  S3_ENDPOINT: 'https://stub.r2.invalid',
  S3_ADMIN_ACCESS_KEY_ID: 'stub',
  S3_ADMIN_SECRET_ACCESS_KEY: 'stub',
  S3_BUCKET_MEDIA: 'stub-media',
  S3_BUCKET_ORIGINALS: 'stub-originals',
  APP_URL: 'https://stub.invalid',
};

const run = (stage?: string) => {
  const result = Bun.spawnSync(['node', SCRIPT], {
    cwd: tmpdir(),
    env: {
      PATH: process.env.PATH ?? '',
      ...COMPLETE_ENV,
      ...(stage === undefined ? {} : { APP_ENV: stage }),
    },
  });
  return { code: result.exitCode, err: result.stderr.toString() };
};

describe('r2-cors-set stage guard', () => {
  test('a retired stage never reaches R2', () => {
    expect(run('preprod').code).toBe(2);
  });

  test('a typo never reaches R2', () => {
    expect(run('devv').code).toBe(2);
  });

  test('local and an unset stage are refused', () => {
    expect(run('local').code).toBe(2);
    expect(run(undefined).code).toBe(2);
  });

  test('the refusal names every stage the guard accepts', () => {
    const { err } = run('preprod');
    expect(err).toContain('dev');
    expect(err).toContain('production');
  });
});
