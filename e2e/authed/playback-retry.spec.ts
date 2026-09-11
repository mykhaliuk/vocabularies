import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { expect, settleHydration, test } from './fixtures';

// The retry bound (VKB-182): a playback URL that fails for a reason a fresh
// signature cannot fix must cost a FINITE number of requests. `retrying` was
// reset in a `finally`, so it only ever closed the door for the length of one
// refresh; nothing counted attempts.
//
// Which engine runs this decides what it proves, and the difference is the
// whole ticket. Chromium delivers the element's 'error' inside that window,
// so the loop stops at one refresh by accident and this spec PASSES against
// the unfixed players. WebKit delivers it after, and the same code runs
// unbounded: 61 refreshes in 5s, measured, one API call and one bucket
// request each. Vocabu is an iOS-first PWA, so WebKit is the engine that
// matters and the one no project in this config uses. Run it with
// E2E_WEBKIT=1 to see this spec fail before the fix.
//
// The failure is injected by rewriting the API's own answer rather than by
// intercepting the media element's request: the players react to whatever URL
// they are handed, and this leaves the media path itself untouched.
//
// It has to run on the feed. The detail page primes the playback cache from
// its SSR payload, which never crosses the wire and so cannot be rewritten —
// the player would simply play.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const TONE = readFileSync(new URL('./assets/tone.m4a', import.meta.url));
const TONE_TYPE = 'audio/mp4';

// A URL that resolves and then does not load: the app server answers this
// path with a 404 page, which the element rejects as an unsupported source.
// Neither player sets `crossOrigin`, so the request is no-cors and the host
// makes no difference to how the failure arrives — this is the plain
// missing-object case, which is the one the ticket reports.
const BROKEN_AUDIO_URL = '/__vkb182-missing-object.m4a';

// One resolve to start the attempt, one refresh after the first failure. The
// bound is what this spec exists to pin, so it is spelled out rather than
// derived.
const EXPECTED_RESOLVES = 2;

// Long enough that an unbounded player would issue many more resolves: each
// cycle is one API call plus one media request, with no backoff.
const SETTLE_MS = 3000;

test.skip(
  NO_STORAGE,
  'needs a reachable bucket (MinIO in CI, infra:up locally)',
);

// The service worker owns same-origin /api/* fetches and would take them out
// of both the route handler and the count.
test.use({ serviceWorkers: 'block' });

test('a playback URL that never loads stops after one refresh', async ({
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

  // Hand the player a URL that resolves cleanly and then fails to load, which
  // is the shape of the bug: the API is healthy, the object is not.
  const entryPath = `/api/entries/${entry.id}`;
  let resolves = 0;
  await authedPage.route(`**${entryPath}`, async (route) => {
    resolves += 1;
    const response = await route.fetch();
    const body = (await response.json()) as {
      playback: { audioUrl: string | null } | null;
    };
    if (body.playback) {
      body.playback.audioUrl = BROKEN_AUDIO_URL;
    }
    await route.fulfill({ response, json: body });
  });

  await authedPage.goto('/feed');
  const player = authedPage.locator('.audio');
  await expect(player).toBeVisible();

  // The row is clickable before its @click listener is attached, and an early
  // click lands in nothing — which reads here as "the player never failed"
  // rather than as a timing problem. `clickUntil` is the usual answer but not
  // this spec's: every click is a fresh attempt, so re-clicking would move the
  // very number being asserted.
  await settleHydration(authedPage);

  await player.locator('.audio__row').click();

  // The player must admit failure rather than keep trying in the background.
  await expect(player.locator('.audio__failed')).toBeVisible();
  await expect(player.locator('.audio__btn--playing')).toBeHidden();

  // Polled, not asserted outright: `failed` is set by the play() rejection,
  // which can land before the refresh it triggered has been issued, so the
  // visible state settles ahead of the count.
  await expect.poll(() => resolves).toBe(EXPECTED_RESOLVES);

  // The failed state is not the assertion on its own: an unbounded player
  // could show it and still be resolving. Nothing may arrive after it.
  await sleep(SETTLE_MS);
  expect(resolves, 'a settled failure issues no further resolves').toBe(
    EXPECTED_RESOLVES,
  );
});
