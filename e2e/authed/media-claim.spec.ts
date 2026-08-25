import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

// The claim-on-ready swap (VKB-143): claimPendingEntry retires an entry's
// incumbent moment and binds the replacement once it is transcoded. It is the
// one place in the product where a bug deletes a user's recording, and until
// this spec its behaviour rested on a throwaway probe script. Runs against a
// real bucket (MinIO in CI since VKB-115) and the real transcode; skips where
// no bucket is reachable.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const TONE = readFileSync(new URL('./assets/tone.m4a', import.meta.url));
const TONE_TYPE = 'audio/mp4';
const AUDIO = { contentType: TONE_TYPE, sizeBytes: TONE.byteLength };

interface UploadSlot {
  mediaId: string;
  key: string;
  uploadUrl: string;
}

const putTone = async (request: APIRequestContext, slot: UploadSlot) => {
  const put = await request.fetch(slot.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': TONE_TYPE },
    data: TONE,
  });
  expect(put.ok()).toBe(true);
};

const confirm = (request: APIRequestContext, slot: UploadSlot) =>
  request.post('/api/media/confirm', { data: { key: slot.key } });

const pollReady = async (page: Page, mediaId: string) => {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(
          `/api/media/status?mediaId=${mediaId}`,
        );
        expect(res.status()).toBe(200);
        const body = (await res.json()) as { status: string; error?: string };
        expect(body.status, body.error ?? '').not.toBe('failed');
        return body.status;
      },
      { timeout: 60_000 },
    )
    .toBe('ready');
};

const boundMediaId = async (page: Page, entryId: string) => {
  const res = await page.request.get(`/api/entries/${entryId}`);
  expect(res.status()).toBe(200);
  const { media } = (await res.json()) as {
    media: { mediaId: string } | null;
  };
  return media?.mediaId ?? null;
};

const statusCode = async (page: Page, mediaId: string) => {
  const res = await page.request.get(`/api/media/status?mediaId=${mediaId}`);
  return res.status();
};

const createEntryWithSlot = async (page: Page) => {
  const created = await page.request.post('/api/entries', {
    data: { word: 'bapple', media: AUDIO },
  });
  expect(created.status()).toBe(201);
  return (await created.json()) as {
    entry: { id: string };
    upload: UploadSlot;
  };
};

const attachSlot = async (page: Page, entryId: string) => {
  const attached = await page.request.post(`/api/entries/${entryId}/media`, {
    data: AUDIO,
  });
  expect(attached.status()).toBe(201);
  const body = (await attached.json()) as { upload: UploadSlot };
  return body.upload;
};

// The originals key is `<userId>/<mediaId>/original.<ext>` — the worker
// redelivery below needs the userId and this is where the product itself
// carries it.
const ownerOf = (slot: UploadSlot) => slot.key.split('/')[0] as string;

const redeliver = (page: Page, slot: UploadSlot) =>
  page.request.post('/api/media/process', {
    data: { key: slot.key, userId: ownerOf(slot) },
  });

test.skip(
  NO_STORAGE,
  'needs a reachable bucket (MinIO in CI, infra:up locally)',
);

test('the incumbent survives until ready, then the swap lands exactly once', async ({
  authedPage,
}) => {
  const { entry, upload: first } = await createEntryWithSlot(authedPage);
  await putTone(authedPage.request, first);
  expect((await confirm(authedPage.request, first)).status()).toBe(200);
  await pollReady(authedPage, first.mediaId);
  expect(await boundMediaId(authedPage, entry.id)).toBe(first.mediaId);

  // A replacement that has not even uploaded leaves the incumbent alone.
  const second = await attachSlot(authedPage, entry.id);
  expect(await boundMediaId(authedPage, entry.id)).toBe(first.mediaId);

  await putTone(authedPage.request, second);
  expect((await confirm(authedPage.request, second)).status()).toBe(200);
  await pollReady(authedPage, second.mediaId);

  // The swap: replacement bound, incumbent's row deleted, not orphaned.
  expect(await boundMediaId(authedPage, entry.id)).toBe(second.mediaId);
  expect(await statusCode(authedPage, first.mediaId)).toBe(404);

  // Idempotent on redelivery: the worker running the same job again must
  // change nothing — same binding, no duplicate, no error.
  const again = await redeliver(authedPage, second);
  expect(again.status()).toBe(200);
  expect(await boundMediaId(authedPage, entry.id)).toBe(second.mediaId);
});

test('competing aims and racing claims leave exactly one moment bound', async ({
  authedPage,
}) => {
  const { entry, upload: first } = await createEntryWithSlot(authedPage);
  await putTone(authedPage.request, first);
  expect((await confirm(authedPage.request, first)).status()).toBe(200);
  await pollReady(authedPage, first.mediaId);

  // Two simultaneous pending aims cannot exist by construction: minting the
  // second detaches the first (VKB-159). The superseded aim still uploads
  // and transcodes, but its ready outcome must land nowhere.
  const superseded = await attachSlot(authedPage, entry.id);
  const replacement = await attachSlot(authedPage, entry.id);
  await putTone(authedPage.request, superseded);
  await putTone(authedPage.request, replacement);
  const [confirmedOld, confirmedNew] = await Promise.all([
    confirm(authedPage.request, superseded),
    confirm(authedPage.request, replacement),
  ]);
  expect(confirmedOld.status()).toBe(200);
  expect(confirmedNew.status()).toBe(200);
  await pollReady(authedPage, superseded.mediaId);
  await pollReady(authedPage, replacement.mediaId);

  expect(await boundMediaId(authedPage, entry.id)).toBe(replacement.mediaId);
  // The incumbent's row was deleted by the swap; the superseded aim's row
  // survives detached — ready, bound to nothing, never stealing the entry.
  expect(await statusCode(authedPage, first.mediaId)).toBe(404);
  expect(await statusCode(authedPage, superseded.mediaId)).toBe(200);

  // The one racing-claims shape left in the product is a double delivery of
  // the same job: two concurrent claims for one mediaId serialise on the
  // entry lock — one bound row, no unique violation, no error.
  const [redeliveredA, redeliveredB] = await Promise.all([
    redeliver(authedPage, replacement),
    redeliver(authedPage, replacement),
  ]);
  expect(redeliveredA.status()).toBe(200);
  expect(redeliveredB.status()).toBe(200);
  expect(await boundMediaId(authedPage, entry.id)).toBe(replacement.mediaId);
});

test('a claim racing the entry delete resolves instead of deadlocking', async ({
  authedPage,
}) => {
  const { entry, upload } = await createEntryWithSlot(authedPage);
  await putTone(authedPage.request, upload);

  // Fire the confirm (whose claim locks entry then media) together with the
  // entry delete (which takes the same locks in the same order through its
  // cascade); a deadlock here would hang past the test timeout. Either
  // ordering is a legitimate outcome — the delete's cascade may take the
  // media row before confirm reads it (404) — what must hold is that both
  // requests resolve.
  const [confirmed, deleted] = await Promise.all([
    confirm(authedPage.request, upload),
    authedPage.request.delete(`/api/entries/${entry.id}`),
  ]);
  expect([200, 404]).toContain(confirmed.status());
  expect(deleted.status()).toBe(204);

  const gone = await authedPage.request.get(`/api/entries/${entry.id}`);
  expect(gone.status()).toBe(404);
});

test('a removed moment is not resurrected by a late redelivery', async ({
  authedPage,
}) => {
  const { entry, upload } = await createEntryWithSlot(authedPage);
  await putTone(authedPage.request, upload);
  expect((await confirm(authedPage.request, upload)).status()).toBe(200);
  await pollReady(authedPage, upload.mediaId);

  const removed = await authedPage.request.delete(
    `/api/entries/${entry.id}/media`,
  );
  expect(removed.status()).toBe(204);
  expect(await boundMediaId(authedPage, entry.id)).toBeNull();

  // The worker redelivers after the removal: the row is gone, so the ready
  // outcome lands nowhere — the moment must stay removed.
  const late = await redeliver(authedPage, upload);
  expect(late.status()).toBe(200);
  expect(await boundMediaId(authedPage, entry.id)).toBeNull();
  expect(await statusCode(authedPage, upload.mediaId)).toBe(404);
});
