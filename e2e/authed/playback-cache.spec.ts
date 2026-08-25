import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

// The playback cache contract (VKB-118): the detail page hands its own
// payload to the module-level cache (primePlayback, client-side only), so
// mounting the player and pressing play must add NO client request beyond
// what the page itself fetches. A broken or inverted client guard leaves the
// browser cache unprimed and the first play issues an extra GET — which is
// exactly what this counts. Needs a ready row, hence a real bucket.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const TONE = readFileSync(new URL('./assets/tone.m4a', import.meta.url));
const TONE_TYPE = 'audio/mp4';

test.skip(
  NO_STORAGE,
  'needs a reachable bucket (MinIO in CI, infra:up locally)',
);

// The service worker owns same-origin /api/* fetches and would hide them
// from the request listener this spec counts with.
test.use({ serviceWorkers: 'block' });

test('priming plus the first play add no entry fetches of their own', async ({
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
  await expect
    .poll(
      async () => {
        const res = await authedPage.request.get(
          `/api/media/status?mediaId=${upload.mediaId}`,
        );
        const body = (await res.json()) as { status: string; error?: string };
        expect(body.status, body.error ?? '').not.toBe('failed');
        return body.status;
      },
      { timeout: 60_000 },
    )
    .toBe('ready');

  const entryUrl = `/api/entries/${entry.id}`;
  let entryFetches = 0;
  authedPage.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === entryUrl) entryFetches += 1;
  });

  // A full navigation renders on the server: the page's own fetch happens
  // inside Nitro and never crosses the wire from the browser, so every
  // client-side GET of this entry counted from here on is an extra one.
  await authedPage.goto(`/entries/${entry.id}`);
  const player = authedPage.locator('.audio');
  await expect(player).toBeVisible();
  expect(entryFetches, 'hydration must reuse the SSR payload').toBe(0);

  await player.locator('.audio__row').click();
  await expect(player.locator('.audio__btn--playing')).toBeVisible();
  expect(entryFetches, 'first play must be served from the primed cache').toBe(
    0,
  );
});
