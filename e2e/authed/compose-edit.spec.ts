import { clickUntil, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// Compose in edit mode (VKB-110, entry-actions-spec §Edit). The upload half
// needs a bucket and lives in tests/unit/media-upload.test.ts; what runs here
// is the prefill, the save, and every way out of the sheet.

const AUDIO = { contentType: 'audio/mp4', sizeBytes: 40_000 };

const createEntry = async (page: Page, data: Record<string, unknown>) => {
  const created = await page.request.post('/api/entries', { data });
  expect(created.status()).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: string } };
  return entry.id;
};

const createSpeaker = async (page: Page, data: Record<string, unknown>) => {
  const created = await page.request.post('/api/speakers', { data });
  expect(created.status()).toBe(201);
  const { speaker } = (await created.json()) as { speaker: { id: string } };
  return speaker.id;
};

const readEntry = async (page: Page, entryId: string) => {
  const found = await page.request.get(`/api/entries/${entryId}`);
  expect(found.status()).toBe(200);
  return (await found.json()) as {
    entry: { word: string; gloss: string | null; story: string | null };
    media: { mediaId: string } | null;
  };
};

const openEditor = async (page: Page) => {
  const menu = page.locator('.actions__menu');
  await clickUntil(page.getByRole('button', { name: /more actions/i }), () =>
    expect(menu).toBeVisible({ timeout: 1000 }),
  );
  await page.getByRole('menuitem', { name: /edit word/i }).click();
  const sheet = page.locator('.compose--open');
  await expect(sheet).toBeVisible();
  return sheet;
};

const confirmSheet = (page: Page) => page.locator('.discard--open');

const failMethod = (page: Page, method: string) =>
  page.route('**/api/entries/**', async (route) => {
    if (route.request().method() === method) {
      await route.fulfill({ status: 500, body: '{}' });
      return;
    }
    await route.continue();
  });

const watchDeletes = (page: Page) => {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'DELETE') return;
    seen.push(new URL(request.url()).pathname);
  });
  return seen;
};

const countEntries = async (page: Page) => {
  const res = await page.request.get('/api/entries');
  const { entries } = (await res.json()) as { entries: unknown[] };
  return entries.length;
};

test.describe('editing a word (authed)', () => {
  test('the sheet opens as the word, not as a blank one', async ({
    authedPage,
  }) => {
    const speakerId = await createSpeaker(authedPage, {
      name: 'Mira',
      rel: 'my daughter',
    });
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
      story: 'said at breakfast',
      sid: speakerId,
    });
    await authedPage.goto(`/entries/${entryId}`);

    await openEditor(authedPage);

    await expect(authedPage.locator('.compose__title')).toHaveText('Edit word');
    await expect(authedPage.locator('#compose-word')).toHaveValue('bapple');
    await expect(authedPage.locator('#compose-gloss')).toHaveValue(
      'apple, but rounder',
    );
    await expect(authedPage.locator('#compose-story')).toHaveValue(
      'said at breakfast',
    );
    await expect(authedPage.locator('.chips__chip--active')).toHaveText(/Mira/);
    await expect(
      authedPage.getByRole('button', { name: /save changes/i }),
    ).toBeVisible();
  });

  test('saving lands on the word and on the screen behind it', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
    });
    await authedPage.goto(`/entries/${entryId}`);
    const sheet = await openEditor(authedPage);

    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await authedPage.locator('#compose-gloss').fill('a rounder apple');
    await authedPage.getByRole('button', { name: /save changes/i }).click();

    await expect(sheet).toBeHidden();
    await expect(authedPage).toHaveURL(new RegExp(`/entries/${entryId}$`));
    await expect(authedPage.locator('.detail__word')).toHaveText(
      '“bapple-corrected”',
    );
    await expect(authedPage.locator('.detail__gloss')).toHaveText(
      'a rounder apple',
    );

    const after = await readEntry(authedPage, entryId);
    expect(after.entry.word).toBe('bapple-corrected');
    expect(after.entry.gloss).toBe('a rounder apple');
  });

  test('clearing the word takes saving away', async ({ authedPage }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    const save = authedPage.getByRole('button', { name: /save changes/i });
    await expect(save).toBeEnabled();

    await authedPage.locator('#compose-word').fill('   ');

    await expect(save).toBeDisabled();
  });

  test('deselecting the speaker gives the word back to you', async ({
    authedPage,
  }) => {
    const speakerId = await createSpeaker(authedPage, {
      name: 'Mira',
      rel: 'my daughter',
    });
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      sid: speakerId,
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    await authedPage.locator('.chips__chip--active').click();
    await expect(authedPage.locator('.chips__chip--active')).toHaveCount(0);
    await authedPage.getByRole('button', { name: /save changes/i }).click();

    await expect(authedPage.locator('.compose--open')).toBeHidden();
    await expect(authedPage.locator('.detail__meta')).toHaveText('You');
  });

  test('an untouched edit closes without asking anything', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
      story: 'said at breakfast',
    });
    await authedPage.goto(`/entries/${entryId}`);
    const sheet = await openEditor(authedPage);

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await expect(sheet).toBeHidden();
    await expect(confirmSheet(authedPage)).toHaveCount(0);
  });

  test('the question is about the changes, never about the word', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);
    await authedPage.locator('#compose-word').fill('bapple-corrected');

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    const question = confirmSheet(authedPage);
    await expect(question).toBeVisible();
    await expect(question).toContainText('Discard your changes?');
    await expect(question).toContainText('The word stays exactly as it was.');
    await expect(question).not.toContainText('Discard this word?');
    await expect(question).not.toContainText(
      'Nothing you put here will be kept.',
    );
  });

  test('keeping editing gives the changes back untouched', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await authedPage.getByRole('button', { name: /keep editing/i }).click();

    await expect(confirmSheet(authedPage)).toHaveCount(0);
    await expect(authedPage.locator('#compose-word')).toHaveValue(
      'bapple-corrected',
    );
  });

  test('leaving mid-edit strands no sheet on the screen behind', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    await authedPage.goto('/feed');
    // Client-side, so the shared open flag survives the hop the way it does
    // for a reader tapping through the feed.
    await authedPage.locator('.entry__link').first().click();
    await expect(authedPage).toHaveURL(new RegExp(`/entries/${entryId}$`));
    await openEditor(authedPage);

    await authedPage.goBack();

    await expect(authedPage).toHaveURL(/\/feed$/);
    await expect(authedPage.locator('.compose--open')).toHaveCount(0);
  });

  test('the kept clip shows as kept, and is only gone once saved', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    await expect(authedPage.locator('.attach__kept-label')).toHaveText(
      'voice kept',
    );
    await authedPage.locator('.attach__remove').click();
    await expect(authedPage.locator('.attach__zone')).toBeVisible();
    expect((await readEntry(authedPage, entryId)).media).not.toBeNull();

    await authedPage.getByRole('button', { name: /save changes/i }).click();

    await expect(authedPage.locator('.compose--open')).toBeHidden();
    const after = await readEntry(authedPage, entryId);
    expect(after.media).toBeNull();
    expect(after.entry.word).toBe('bapple');
  });

  test('an abandoned removal leaves the clip on the word', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    const kept = (await readEntry(authedPage, entryId)).media?.mediaId;
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    await authedPage.locator('.attach__remove').click();
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await authedPage.getByRole('button', { name: /discard changes/i }).click();

    await expect(authedPage.locator('.compose--open')).toBeHidden();
    expect((await readEntry(authedPage, entryId)).media?.mediaId).toBe(kept);
  });
});

// A clip that reached the server once must not stand in for the next one.
// The sheet skips an upload it already made; that shortcut is keyed on the
// file, and the slot it was signed against goes with it.
test.describe('replacing a clip after a failed save', () => {
  test.use({ serviceWorkers: 'block' });

  test('sends the new bytes against a slot of their own', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    const uploaded: number[] = [];
    const slots: string[] = [];
    await authedPage.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        uploaded.push(request.postDataBuffer()?.length ?? 0);
        slots.push(new URL(request.url()).pathname);
        await route.fulfill({ status: 200, body: '' });
        return;
      }
      // Nothing really reaches a bucket here, so the confirm — which HEADs
      // the object — is answered for it.
      if (request.url().endsWith('/api/media/confirm')) {
        await route.fulfill({ status: 200, body: '{}' });
        return;
      }
      // The row write always fails, so the sheet stays open over a landed
      // upload — the only state in which a replacement can be picked.
      if (request.method() === 'PATCH') {
        await route.fulfill({ status: 500, body: '{}' });
        return;
      }
      await route.continue();
    });

    const pick = (name: string, bytes: string) =>
      authedPage.locator('.attach__input').setInputFiles({
        name,
        mimeType: 'audio/mp4',
        buffer: Buffer.from(bytes),
      });
    const save = () =>
      authedPage.getByRole('button', { name: /save changes/i }).click();

    // An edited field is what gives the commit a PATCH to refuse; without one
    // the save would succeed and close over the landed upload.
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await pick('first.m4a', 'the first clip');
    await save();
    await expect(authedPage.locator('.compose__error')).toBeVisible();
    expect(uploaded).toHaveLength(1);

    await pick('second.m4a', 'the second clip, which is a different length');
    await save();
    await expect(authedPage.locator('.compose__error')).toBeVisible();

    expect(uploaded).toHaveLength(2);
    expect(uploaded[1]).not.toBe(uploaded[0]);
    // Signed against the first file's length, the old slot would refuse them.
    expect(slots[1]).not.toBe(slots[0]);
  });
});

test.describe('a half-applied save', () => {
  test.use({ serviceWorkers: 'block' });

  test('a refused write keeps the clip the user asked to drop', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    const kept = (await readEntry(authedPage, entryId)).media?.mediaId;
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    await authedPage.locator('.attach__remove').click();
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await failMethod(authedPage, 'PATCH');
    await authedPage.getByRole('button', { name: /save changes/i }).click();
    await expect(authedPage.locator('.compose__error')).toBeVisible();

    // A recording is the one thing here the user cannot get back, so a save
    // that refuses must not have spent it on the way to failing.
    expect((await readEntry(authedPage, entryId)).media?.mediaId).toBe(kept);
  });

  test('dropping only the clip claims nothing else was saved', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    // The clip is the only thing touched, and its removal is what fails, so
    // there is nothing the sheet could honestly call saved.
    await authedPage.locator('.attach__remove').click();
    await failMethod(authedPage, 'DELETE');
    await authedPage.getByRole('button', { name: /save changes/i }).click();
    await expect(authedPage.locator('.compose__error')).toBeVisible();

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await expect(confirmSheet(authedPage)).toContainText(
      'The word stays exactly as it was.',
    );
  });

  test('nothing landed, so the question still promises nothing did', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'bapple' });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await failMethod(authedPage, 'PATCH');
    await authedPage.getByRole('button', { name: /save changes/i }).click();
    await expect(authedPage.locator('.compose__error')).toBeVisible();

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await expect(confirmSheet(authedPage)).toContainText(
      'The word stays exactly as it was.',
    );
  });

  test('once the text landed, the question stops saying it did not', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    // The removal is refused, so the PATCH ahead of it has already landed.
    await authedPage.locator('.attach__remove').click();
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await failMethod(authedPage, 'DELETE');
    await authedPage.getByRole('button', { name: /save changes/i }).click();
    await expect(authedPage.locator('.compose__error')).toBeVisible();
    expect((await readEntry(authedPage, entryId)).entry.word).toBe(
      'bapple-corrected',
    );

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    const question = confirmSheet(authedPage);
    await expect(question).toContainText(
      'Some of your changes are already saved',
    );
    await expect(question).not.toContainText(
      'The word stays exactly as it was.',
    );
  });

  test('the screen behind catches up on what did land', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      media: AUDIO,
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);

    await authedPage.locator('.attach__remove').click();
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await failMethod(authedPage, 'DELETE');
    await authedPage.getByRole('button', { name: /save changes/i }).click();
    await expect(authedPage.locator('.compose__error')).toBeVisible();

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await authedPage.getByRole('button', { name: /discard changes/i }).click();
    await expect(authedPage.locator('.compose--open')).toBeHidden();

    // Left on the old word, the detail would contradict the sheet that just
    // said some changes were saved — and re-opening the editor would prefill
    // from it and write the correction back out.
    await expect(authedPage.locator('.detail__word')).toHaveText(
      '“bapple-corrected”',
    );
  });
});

// Dismissing compose deletes what the session created (VKB-154). The same
// gesture in edit mode is aimed at a word the user already owns, so the
// absence of that DELETE is the assertion — a screen that merely looks right
// would pass while the word was being deleted underneath it.
test.describe('cancelling an edit', () => {
  // page.on('request') attributes an /api/* call to the service worker that
  // claims it (service-worker/sw.js), not to the page.
  test.use({ serviceWorkers: 'block' });

  test('with only the text rewritten, writes nothing', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
      story: 'said at breakfast',
    });
    const deletions = watchDeletes(authedPage);

    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await authedPage.locator('#compose-gloss').fill('rewritten');
    await authedPage.locator('#compose-story').fill('rewritten too');

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await authedPage.getByRole('button', { name: /discard changes/i }).click();
    await expect(authedPage.locator('.compose--open')).toBeHidden();

    expect(deletions).toEqual([]);
    const after = await readEntry(authedPage, entryId);
    expect(after.entry.word).toBe('bapple');
    expect(after.entry.gloss).toBe('apple, but rounder');
    expect(after.entry.story).toBe('said at breakfast');
  });

  test('after a save that reached the server, deletes nothing', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
    });
    const deletions = watchDeletes(authedPage);

    await authedPage.goto(`/entries/${entryId}`);
    await openEditor(authedPage);
    await authedPage.locator('#compose-word').fill('bapple-corrected');
    await authedPage.locator('.attach__input').setInputFiles({
      name: 'clip.m4a',
      mimeType: 'audio/mp4',
      buffer: Buffer.from('not really an m4a, and it never has to be'),
    });
    await expect(authedPage.locator('.attach__kept-label')).toHaveText(
      'voice kept',
    );

    // Refuse the bytes, so the slot exists on the server and the upload does
    // not. Deliberate, not ambient: the suite runs without a bucket, but the
    // reason a real PUT fails differs per environment, and the state being
    // cancelled from is too important to inherit from any of them.
    await authedPage.route('**/*', async (route) => {
      if (route.request().method() === 'PUT') await route.abort('failed');
      else await route.continue();
    });

    await authedPage.getByRole('button', { name: /save changes/i }).click();
    await expect(authedPage.locator('.attach__fail')).toBeVisible();

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await authedPage.getByRole('button', { name: /discard changes/i }).click();
    await expect(authedPage.locator('.compose--open')).toBeHidden();

    expect(deletions).toEqual([]);
    // A slot opened against no entry would have created a second word here.
    expect(await countEntries(authedPage)).toBe(1);
    expect((await readEntry(authedPage, entryId)).entry.word).toBe('bapple');
  });
});
