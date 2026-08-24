import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { Locator } from '@playwright/test';

// The full media path against a real bucket (VKB-115): presign, PUT, confirm,
// the bundled-ffmpeg transcode (inline and detached at APP_ENV=local), and
// the ready row rendered by the real players. In CI the bucket is the MinIO
// container the e2e-authed job starts; locally it is `infra:up`'s MinIO.
// Without a bucket the spec skips — the rest of the suite stays infra-free.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const TONE = readFileSync(new URL('./assets/tone.m4a', import.meta.url));
const TONE_TYPE = 'audio/mp4';

// The shipped metric table (utils/media-metrics.ts) as rendered: the players
// bind it to CSS vars and the glyph size, so reading those back from the DOM
// is the proof the components consume the table — the gap VKB-115 measured
// (giving inline the big metrics left the whole suite green).
const INLINE_AUDIO = { maxW: '340px', btn: '38px', wave: '24px', glyph: '16' };
const BIG_AUDIO = { maxW: '360px', btn: '44px', wave: '30px', glyph: '17' };

interface StatusBody {
  status: string;
  error?: string;
  audioUrl?: string;
}

const audioVars = (locator: Locator) =>
  locator.evaluate((el: HTMLElement) => ({
    maxW: el.style.getPropertyValue('--audio-max-w'),
    btn: el.style.getPropertyValue('--audio-btn'),
    wave: el.style.getPropertyValue('--audio-wave-h'),
  }));

test.skip(
  NO_STORAGE,
  'needs a reachable bucket (MinIO in CI, infra:up locally)',
);

test('an uploaded moment reaches ready and both players render the shipped metrics', async ({
  authedPage,
}) => {
  const created = await authedPage.request.post('/api/entries', {
    data: {
      word: 'bapple',
      media: { contentType: TONE_TYPE, sizeBytes: TONE.byteLength },
    },
  });
  expect(created.status()).toBe(201);
  const { entry, upload } = (await created.json()) as {
    entry: { id: string };
    upload: { mediaId: string; key: string; uploadUrl: string };
  };

  const put = await authedPage.request.fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': TONE_TYPE },
    data: TONE,
  });
  expect(put.ok()).toBe(true);

  const confirmed = await authedPage.request.post('/api/media/confirm', {
    data: { key: upload.key },
  });
  expect(confirmed.status()).toBe(200);

  // Processing is detached at APP_ENV=local, so confirm returns before the
  // transcode lands; the status endpoint is the contract to wait on. A
  // failure surfaces the row's error instead of a bare timeout.
  let status: StatusBody = { status: 'processing' };
  await expect
    .poll(
      async () => {
        const res = await authedPage.request.get(
          `/api/media/status?mediaId=${upload.mediaId}`,
        );
        expect(res.status()).toBe(200);
        status = (await res.json()) as StatusBody;
        expect(status.status, status.error ?? '').not.toBe('failed');
        return status.status;
      },
      { timeout: 60_000 },
    )
    .toBe('ready');

  expect(status.audioUrl).toBeTruthy();
  const playable = await authedPage.request.get(status.audioUrl as string);
  expect(playable.status()).toBe(200);

  await authedPage.reload();
  const feedPlayer = authedPage.locator('.audio');
  await expect(feedPlayer).toBeVisible();
  expect(await audioVars(feedPlayer)).toEqual({
    maxW: INLINE_AUDIO.maxW,
    btn: INLINE_AUDIO.btn,
    wave: INLINE_AUDIO.wave,
  });
  await expect(feedPlayer.locator('.audio__btn svg')).toHaveAttribute(
    'width',
    INLINE_AUDIO.glyph,
  );

  await authedPage.goto(`/entries/${entry.id}`);
  const detailPlayer = authedPage.locator('.audio');
  await expect(detailPlayer).toBeVisible();
  expect(await audioVars(detailPlayer)).toEqual({
    maxW: BIG_AUDIO.maxW,
    btn: BIG_AUDIO.btn,
    wave: BIG_AUDIO.wave,
  });
  await expect(detailPlayer.locator('.audio__btn svg')).toHaveAttribute(
    'width',
    BIG_AUDIO.glyph,
  );
});
