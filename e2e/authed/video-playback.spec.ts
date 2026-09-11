import { readFileSync } from 'node:fs';
import pg from 'pg';
import { watchPublicInternet } from '../hermetic';
import { expect, settleHydration, signIn, test as base } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// FeedVideoPlayer end to end (VKB-183). Runs only on webkit-media: the
// derivative is H.264, which Linux Chromium builds cannot decode.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const CLIP = readFileSync(new URL('./assets/clip.mp4', import.meta.url));
const CLIP_TYPE = 'video/mp4';

// Resolves, then fails to load: the app server answers it with a 404 page.
const BROKEN_VIDEO_URL = '/__vkb183-missing-object.mp4';

// Video upload is a premium right, and every sign-in here is a new free user.
const grantPremium = async (email: string) => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `update users set plan = 'premium' where lower(email) = lower($1)`,
      [email],
    );
    expect(rowCount, `no user row for ${email}`).toBe(1);
  } finally {
    await client.end();
  }
};

const test = base.extend<{ premiumPage: Page }>({
  premiumPage: async ({ page }, use) => {
    const assertHermetic = watchPublicInternet(page.context());
    await grantPremium(await signIn(page));
    await use(page);
    assertHermetic();
  },
});

const uploadReadyVideo = async (page: Page) => {
  const created = await page.request.post('/api/entries', {
    data: {
      word: 'bapple',
      media: { contentType: CLIP_TYPE, sizeBytes: CLIP.byteLength },
    },
  });
  expect(created.status()).toBe(201);
  const { entry, upload } = (await created.json()) as {
    entry: { id: string };
    upload: { mediaId: string; key: string; uploadUrl: string };
  };

  const put = await page.request.fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': CLIP_TYPE },
    data: CLIP,
  });
  expect(put.ok()).toBe(true);
  const confirmed = await page.request.post('/api/media/confirm', {
    data: { key: upload.key },
  });
  expect(confirmed.status()).toBe(200);
  await expect
    .poll(
      async () => {
        const res = await page.request.get(
          `/api/media/status?mediaId=${upload.mediaId}`,
        );
        const body = (await res.json()) as { status: string; error?: string };
        expect(body.status, body.error ?? '').not.toBe('failed');
        return body.status;
      },
      { timeout: 60_000 },
    )
    .toBe('ready');
  return entry.id;
};

const playedSec = (video: Locator) =>
  video.evaluate((element: HTMLVideoElement) => element.currentTime);

test.skip(
  NO_STORAGE,
  'needs a reachable bucket (MinIO in CI, infra:up locally)',
);

// The service worker owns same-origin /api/* and would bypass page.route.
test.use({ serviceWorkers: 'block' });

test('a ready video expands, plays and collapses', async ({ premiumPage }) => {
  await uploadReadyVideo(premiumPage);

  await premiumPage.goto('/feed');
  const player = premiumPage.locator('.video');
  await expect(player).toBeVisible();
  await settleHydration(premiumPage);

  await player.locator('.video__row').click();
  const video = player.locator('.video__el');
  await expect(video).toBeVisible();
  await expect.poll(() => playedSec(video)).toBeGreaterThan(0);

  await player.locator('.video__chev').click();
  await expect(video).toHaveCount(0);
  await expect(player.locator('.video__row')).toBeVisible();
});

test('a stale signature recovers on the one refresh', async ({
  premiumPage,
}) => {
  const entryId = await uploadReadyVideo(premiumPage);

  let resolves = 0;
  await premiumPage.route(`**/api/entries/${entryId}`, async (route) => {
    resolves += 1;
    const response = await route.fetch();
    const body = (await response.json()) as {
      playback: { videoUrl: string | null } | null;
    };
    if (resolves === 1 && body.playback) {
      body.playback.videoUrl = BROKEN_VIDEO_URL;
    }
    await route.fulfill({ response, json: body });
  });

  await premiumPage.goto('/feed');
  const player = premiumPage.locator('.video');
  await expect(player).toBeVisible();
  // Not clickUntil: every tap is a fresh attempt and would move the count.
  await settleHydration(premiumPage);

  await player.locator('.video__row').click();
  const video = player.locator('.video__el');
  await expect.poll(() => playedSec(video)).toBeGreaterThan(0);
  expect(resolves).toBe(2);
  await expect(player.locator('.video__row')).toHaveCount(0);
});
