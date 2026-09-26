import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// late-spike.m4a: 5s of quiet tone with a loud burst at 4.00–4.25s.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const SPIKE = readFileSync(new URL('./assets/late-spike.m4a', import.meta.url));
const SPIKE_TYPE = 'audio/mp4';
const SPIKE_START = 0.8;
const SPIKE_END = 0.85;
const SUBPIXEL = 0.5;

test.skip(
  NO_STORAGE,
  'needs a reachable bucket (MinIO in CI, infra:up locally)',
);

const createReadyEntry = async (page: Page) => {
  const created = await page.request.post('/api/entries', {
    data: {
      word: 'spike',
      media: { contentType: SPIKE_TYPE, sizeBytes: SPIKE.byteLength },
    },
  });
  expect(created.status()).toBe(201);
  const { entry, upload } = (await created.json()) as {
    entry: { id: string };
    upload: { mediaId: string; key: string; uploadUrl: string };
  };

  const put = await page.request.fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': SPIKE_TYPE },
    data: SPIKE,
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

const measureWave = (player: Locator) =>
  player.locator('.audio__wave').evaluate((wave) => {
    const box = wave.getBoundingClientRect();
    const bars = [
      ...wave.querySelectorAll(
        '.audio__bars:not(.audio__bars--played) .audio__bar',
      ),
    ].map((bar) => bar.getBoundingClientRect());
    return {
      box: { left: box.left, right: box.right, height: box.height },
      bars: bars.map((bar) => ({
        left: bar.left,
        right: bar.right,
        height: bar.height,
      })),
    };
  });

const expectWholeClipInBox = async (player: Locator) => {
  await expect(player).toBeVisible();
  const { box, bars } = await measureWave(player);
  expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) {
    expect(bar.left).toBeGreaterThanOrEqual(box.left - SUBPIXEL);
    expect(bar.right).toBeLessThanOrEqual(box.right + SUBPIXEL);
  }

  const tallest = Math.max(...bars.map((bar) => bar.height));
  expect(tallest).toBeGreaterThanOrEqual(box.height - SUBPIXEL);
  const loud = bars.filter((bar) => bar.height >= tallest - SUBPIXEL);
  const width = box.right - box.left;
  for (const bar of loud) {
    const centre = (bar.left + bar.right) / 2 - box.left;
    expect(centre / width).toBeGreaterThan(SPIKE_START - 0.05);
    expect(centre / width).toBeLessThan(SPIKE_END + 0.05);
  }
};

test('a late loud moment is drawn in full, in the feed and on the word', async ({
  authedPage,
}) => {
  const entryId = await createReadyEntry(authedPage);

  await authedPage.reload();
  await expectWholeClipInBox(authedPage.locator('.audio'));

  await authedPage.goto(`/entries/${entryId}`);
  await expectWholeClipInBox(authedPage.locator('.audio'));
});

test('a narrow screen thins the bars instead of cutting the clip', async ({
  authedPage,
}) => {
  await createReadyEntry(authedPage);
  await authedPage.setViewportSize({ width: 320, height: 640 });

  await authedPage.reload();
  await expectWholeClipInBox(authedPage.locator('.audio'));
});
