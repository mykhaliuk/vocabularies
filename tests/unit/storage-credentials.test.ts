import { describe, expect, test } from 'bun:test';

// Presigning is a local HMAC — it signs against the endpoint and never dials
// it — so these assert credential selection without a reachable bucket.
process.env.S3_ENDPOINT ??= 'http://s3.invalid';
process.env.S3_BUCKET_MEDIA ??= 'unit-test-media';
process.env.S3_BUCKET_ORIGINALS ??= 'unit-test-originals';
process.env.S3_FORCE_PATH_STYLE ??= 'true';
process.env.S3_MEDIA_ACCESS_KEY_ID = 'media-key';
process.env.S3_MEDIA_SECRET_ACCESS_KEY = 'media-secret';

const { presignPut } = await import('../../server/utils/storage');

const signingKey = (url: string) =>
  new URL(url).searchParams.get('X-Amz-Credential')?.split('/')[0];

const putOriginals = () =>
  presignPut('probe', 'text/plain', { kind: 'originals' });

// Order matters: a client is cached per bucket kind on first use, so the
// missing-credential cases have to run before anything builds the originals
// client. The media pair stays set throughout — that is the point, a media
// credential must never stand in for the originals one.
describe('per-bucket credentials', () => {
  test('a missing originals key throws instead of using the media one', () => {
    expect(putOriginals()).rejects.toThrow('S3_ORIGINALS_ACCESS_KEY_ID');
  });

  test('a missing originals secret throws too', () => {
    process.env.S3_ORIGINALS_ACCESS_KEY_ID = 'originals-key';
    expect(putOriginals()).rejects.toThrow('S3_ORIGINALS_SECRET_ACCESS_KEY');
  });

  test('media signs while originals is still unconfigured', async () => {
    const url = await presignPut('probe', 'text/plain', { kind: 'media' });
    expect(signingKey(url)).toBe('media-key');
  });

  test('each bucket signs with its own key', async () => {
    process.env.S3_ORIGINALS_SECRET_ACCESS_KEY = 'originals-secret';
    expect(signingKey(await putOriginals())).toBe('originals-key');
    const media = await presignPut('probe', 'text/plain', { kind: 'media' });
    expect(signingKey(media)).toBe('media-key');
  });
});
