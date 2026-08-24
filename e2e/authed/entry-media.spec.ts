import { expect, signIn, test } from './fixtures';
import type { Page } from '@playwright/test';

// The swap itself has NO automated coverage, here or in unit tests — it runs
// at `ready`, and none of these specs confirms an upload (media-ready.spec.ts
// walks that path since VKB-115). Pinned by hand against Postgres; VKB-143
// tracks closing the gap. See ADR-0009.

const AUDIO = { contentType: 'audio/mp4', sizeBytes: 40_000 };

interface MediaBody {
  media: { mediaId: string; status: string } | null;
}

const createEntry = async (page: Page, data: Record<string, unknown>) => {
  const created = await page.request.post('/api/entries', { data });
  expect(created.status()).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: string } };
  return entry.id;
};

const attachMedia = async (page: Page, entryId: string) => {
  const attached = await page.request.post(`/api/entries/${entryId}/media`, {
    data: AUDIO,
  });
  expect(attached.status()).toBe(201);
  return (await attached.json()) as MediaBody & {
    upload: { mediaId: string; key: string; uploadUrl: string };
  };
};

const readEntry = async (page: Page, entryId: string) => {
  const found = await page.request.get(`/api/entries/${entryId}`);
  expect(found.status()).toBe(200);
  return (await found.json()) as MediaBody;
};

test.describe('entry media (authed)', () => {
  test('a slot can be minted against an existing entry', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    expect((await readEntry(authedPage, entryId)).media).toBeNull();

    const attached = await attachMedia(authedPage, entryId);

    expect(attached.upload.uploadUrl).toContain(attached.upload.key);
    expect(attached.media?.status).toBe('processing');
    expect(attached.media?.mediaId).toBe(attached.upload.mediaId);
  });

  test('an abandoned replace leaves the kept moment exactly as it was', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    const kept = (await readEntry(authedPage, entryId)).media?.mediaId;
    expect(kept).toBeTruthy();

    const replacement = await attachMedia(authedPage, entryId);
    expect(replacement.upload.mediaId).not.toBe(kept);

    const after = await readEntry(authedPage, entryId);
    expect(after.media?.mediaId).toBe(kept);
    expect(
      (
        await authedPage.request.get(`/api/media/status?mediaId=${kept}`)
      ).status(),
    ).toBe(200);

    const feed = await authedPage.request.get('/api/entries');
    expect(feed.status()).toBe(200);
    const { entries } = (await feed.json()) as {
      entries: { id: string; media: { mediaId: string } | null }[];
    };
    const listed = entries.filter((entry) => entry.id === entryId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.media?.mediaId).toBe(kept);
  });

  // Named for what it actually pins. Until VKB-159 this test was called
  // "aiming twice at one entry is allowed and still changes nothing", which
  // stopped being true — minting now detaches the aims it supersedes — while
  // the assertions kept passing, because they only ever looked at the bound
  // row. A test that goes red asks to be rewritten; one that keeps passing
  // while describing behaviour the code no longer has does not.
  //
  // What is NOT covered here: whether the detach works. These specs never
  // confirm an upload, so no pending row reaches `ready` and the ordering
  // this guards stays unreachable — VKB-115 gave CI a bucket (media-ready
  // walks it), but driving a replacement to `ready` is VKB-143's spec; the
  // detach itself was verified by hand against a real bucket (ADR-0009).
  test('an unconfirmed aim stays invisible to reads', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    const kept = (await readEntry(authedPage, entryId)).media?.mediaId;

    const first = await attachMedia(authedPage, entryId);
    const second = await attachMedia(authedPage, entryId);
    expect(second.upload.mediaId).not.toBe(first.upload.mediaId);

    // The incumbent is untouched by either aim: retirement happens at the
    // `ready` transition, never at mint.
    expect((await readEntry(authedPage, entryId)).media?.mediaId).toBe(kept);
  });

  test('removing takes the moment and leaves the word', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
      media: AUDIO,
    });

    const removed = await authedPage.request.delete(
      `/api/entries/${entryId}/media`,
    );
    expect(removed.status()).toBe(204);

    const after = await readEntry(authedPage, entryId);
    expect(after.media).toBeNull();
    const { entry } = (await (
      await authedPage.request.get(`/api/entries/${entryId}`)
    ).json()) as { entry: { word: string } };
    expect(entry.word).toBe('bapple');

    const again = await authedPage.request.delete(
      `/api/entries/${entryId}/media`,
    );
    expect(again.status()).toBe(204);
  });

  test('a moment can be removed and a new one aimed at the entry', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'appo',
      media: AUDIO,
    });

    expect(
      (
        await authedPage.request.delete(`/api/entries/${entryId}/media`)
      ).status(),
    ).toBe(204);
    await attachMedia(authedPage, entryId);

    expect((await readEntry(authedPage, entryId)).media).toBeNull();
  });

  test('an entry that is not yours is not there', async ({
    authedPage,
    browser,
  }) => {
    const strangerContext = await browser.newContext();
    const stranger = await strangerContext.newPage();
    await signIn(stranger);
    const theirEntry = await createEntry(stranger, { word: 'bapple' });

    const attached = await authedPage.request.post(
      `/api/entries/${theirEntry}/media`,
      { data: AUDIO },
    );
    expect(attached.status()).toBe(404);
    const removed = await authedPage.request.delete(
      `/api/entries/${theirEntry}/media`,
    );
    expect(removed.status()).toBe(404);

    const theirs = await attachMedia(stranger, theirEntry);
    expect(theirs.media?.status).toBe('processing');

    await strangerContext.close();
  });

  test('an unknown entry is a 404 and a malformed id a 400', async ({
    authedPage,
  }) => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect(
      (
        await authedPage.request.post(`/api/entries/${unknown}/media`, {
          data: AUDIO,
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await authedPage.request.delete(`/api/entries/${unknown}/media`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await authedPage.request.post('/api/entries/not-a-uuid/media', {
          data: AUDIO,
        })
      ).status(),
    ).toBe(400);
  });

  test('an unsupported content type never mints a slot', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });

    const rejected = await authedPage.request.post(
      `/api/entries/${entryId}/media`,
      { data: { contentType: 'application/pdf', sizeBytes: 40_000 } },
    );
    expect(rejected.status()).toBe(400);
    expect((await readEntry(authedPage, entryId)).media).toBeNull();
  });
});
