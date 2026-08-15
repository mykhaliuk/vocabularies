import { tmpdir } from 'node:os';
import { describe, expect, test } from 'bun:test';

// storage.ts caches one client per bucket kind, so which credential a call
// signs with depends on what has already been built in the process. Any
// assertion about that has to own its process — in-file env juggling only
// proves anything when no other test file imported storage.ts first, which
// is a property of the runner's module registry, not of the code.
const BASE_ENV = {
  S3_ENDPOINT: 'http://s3.invalid',
  S3_BUCKET_MEDIA: 'unit-test-media',
  S3_BUCKET_ORIGINALS: 'unit-test-originals',
  S3_FORCE_PATH_STYLE: 'true',
  S3_MEDIA_ACCESS_KEY_ID: 'media-key',
  S3_MEDIA_SECRET_ACCESS_KEY: 'media-secret',
  S3_ORIGINALS_ACCESS_KEY_ID: 'originals-key',
  S3_ORIGINALS_SECRET_ACCESS_KEY: 'originals-secret',
};

// Prints the access-key id a presigned URL was signed with, or the error.
// The module is imported by absolute path because the probe deliberately
// runs outside the repo: bun auto-loads .env/.env.local from the working
// directory, which would put the real credentials back into an env this
// test exists to take them out of.
const SCRIPT = `
const { presignPut } = await import(process.env.PROBE_MODULE);
try {
  const url = await presignPut('probe', 'text/plain', {
    kind: process.env.PROBE_KIND,
  });
  const credential = new URL(url).searchParams.get('X-Amz-Credential');
  console.log('SIGNED:' + credential.split('/')[0]);
} catch (error) {
  console.log('THREW:' + error.message);
}
`;

const STORAGE_MODULE = new URL('../../server/utils/storage.ts', import.meta.url)
  .pathname;

const sign = (kind: 'media' | 'originals', omit: string[] = []) => {
  const env: Record<string, string> = {
    ...BASE_ENV,
    PROBE_KIND: kind,
    PROBE_MODULE: STORAGE_MODULE,
  };
  for (const key of omit) delete env[key];
  const result = Bun.spawnSync(['bun', '-e', SCRIPT], {
    cwd: tmpdir(),
    env: { ...env, PATH: process.env.PATH ?? '' },
  });
  const line = result.stdout
    .toString()
    .split('\n')
    .find((entry) => entry.startsWith('SIGNED:') || entry.startsWith('THREW:'));
  if (!line) throw new Error(`probe produced no verdict: ${result.stderr}`);
  return line;
};

describe('per-bucket credentials', () => {
  test('each bucket signs with its own key', () => {
    expect(sign('media')).toBe('SIGNED:media-key');
    expect(sign('originals')).toBe('SIGNED:originals-key');
  });

  test('a missing originals key throws instead of using the media one', () => {
    expect(sign('originals', ['S3_ORIGINALS_ACCESS_KEY_ID'])).toBe(
      'THREW:[storage] S3_ORIGINALS_ACCESS_KEY_ID is required',
    );
  });

  test('a missing originals secret throws too', () => {
    expect(sign('originals', ['S3_ORIGINALS_SECRET_ACCESS_KEY'])).toBe(
      'THREW:[storage] S3_ORIGINALS_SECRET_ACCESS_KEY is required',
    );
  });

  test('media keeps working while originals is unconfigured', () => {
    expect(
      sign('media', [
        'S3_ORIGINALS_ACCESS_KEY_ID',
        'S3_ORIGINALS_SECRET_ACCESS_KEY',
      ]),
    ).toBe('SIGNED:media-key');
  });
});
