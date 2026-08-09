import { clickUntil, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// Correcting the date in place (VKB-111, speaker-spec §Correcting the date).
// The write lands as you pick — there is no save button — so every
// assertion about persistence here is made without a confirm step.

// Mira was 19 months old on 8 April 2026 and 7 months old a year earlier.
// Two dates a year apart, both with single-digit days in a month whose short
// and long names differ: every part of the rendered label is a different
// string when it is wrong.
const BIRTHDAY = '2024-09-04';
const SAID_AT = '2026-04-08';
const SAID_AT_LABEL = '8 Apr 2026';
const AGE_LABEL = '19 mo';
const CORRECTED = '2025-04-08';
const CORRECTED_LABEL = '8 Apr 2025';
const CORRECTED_AGE = '7 mo';

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

const dateEntry = async (page: Page, entryId: string, saidAt: string) => {
  const patched = await page.request.patch(`/api/entries/${entryId}`, {
    data: { saidAt },
  });
  expect(patched.status()).toBe(200);
};

// The resting line is the trigger, and it is a @click button: server-rendered
// markup passes every actionability check before Vue attaches the listener.
const openTheEditor = async (page: Page) => {
  const field = page.locator('.detail__date-field');
  await clickUntil(page.locator('.detail__said-body'), () =>
    expect(field).toBeVisible({ timeout: 1000 }),
  );
  return field;
};

test.describe('correcting the day a word was said', () => {
  test('a picked date re-ages the word, with no save button', async ({
    authedPage,
  }) => {
    const speakerId = await createSpeaker(authedPage, {
      name: 'Mira',
      rel: 'my daughter',
      birthday: BIRTHDAY,
    });
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      sid: speakerId,
    });
    await dateEntry(authedPage, entryId, SAID_AT);

    await authedPage.goto(`/entries/${entryId}`);
    const field = await openTheEditor(authedPage);

    // The consequence sentence starts on the date the word already carries.
    const note = authedPage.locator('.detail__date-note');
    await expect(note).toContainText(`they were ${AGE_LABEL}`);

    await field.fill(CORRECTED);

    // Re-derived from the candidate, not from what the server last returned.
    await expect(note).toContainText(`they were ${CORRECTED_AGE}`);

    // "done" is the only control in the editor: the change has already landed,
    // so there is nothing left to save.
    const editor = authedPage.locator('.detail__date');
    await expect(editor.getByRole('button')).toHaveCount(1);
    await editor.getByRole('button', { name: /done/i }).click();

    await expect(authedPage.locator('.detail__said')).toHaveText(
      `said ${CORRECTED_LABEL} · ${CORRECTED_AGE} edit`,
    );
    // The metaline is the other half of the frozen age, and it moved too.
    await expect(authedPage.locator('.detail__meta')).toHaveText(
      `Mira · my daughter · ${CORRECTED_AGE}`,
    );

    // Reloading is what separates a screen that changed from a word that did.
    await authedPage.reload();
    await expect(authedPage.locator('.detail__said')).toHaveText(
      `said ${CORRECTED_LABEL} · ${CORRECTED_AGE} edit`,
    );
  });

  test('a word with no age still gets the row', async ({ authedPage }) => {
    // The date is worth keeping right on its own (spec §Correcting the date),
    // so an unattributed word gets the same affordance — with the sentence
    // that has no age to report.
    const entryId = await createEntry(authedPage, { word: 'appo' });

    await authedPage.goto(`/entries/${entryId}`);
    const field = await openTheEditor(authedPage);

    await expect(authedPage.locator('.detail__date-note')).toHaveText(
      'the day they said it, not the day you filed it.',
    );

    await field.fill(CORRECTED);
    await authedPage.locator('.detail__date-done').click();

    await expect(authedPage.locator('.detail__said')).toHaveText(
      `said ${CORRECTED_LABEL} edit`,
    );
  });

  test('a birthday after the picked day renders no age at all', async ({
    authedPage,
  }) => {
    // shared/speaker-age: an anchor before the birthday derives nothing,
    // silently. Corrected onto a day the speaker had not been born yet, the
    // age has to disappear rather than come back negative or as "newborn".
    const speakerId = await createSpeaker(authedPage, {
      name: 'Theo',
      rel: 'my son',
      birthday: '2026-04-01',
    });
    const entryId = await createEntry(authedPage, {
      word: 'nana',
      sid: speakerId,
    });
    await dateEntry(authedPage, entryId, SAID_AT);

    await authedPage.goto(`/entries/${entryId}`);
    const field = await openTheEditor(authedPage);
    await field.fill(CORRECTED);

    await expect(authedPage.locator('.detail__date-note')).toHaveText(
      'the day they said it, not the day you filed it.',
    );

    await authedPage.locator('.detail__date-done').click();
    await expect(authedPage.locator('.detail__said')).toHaveText(
      `said ${CORRECTED_LABEL} edit`,
    );
    await expect(authedPage.locator('.detail__meta')).toHaveText(
      'Theo · my son',
    );
  });

  test('a date the server refuses leaves the word as it was', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await dateEntry(authedPage, entryId, SAID_AT);

    await authedPage.goto(`/entries/${entryId}`);
    const field = await openTheEditor(authedPage);

    // The picker's own `max` stops at today, so this is typed past it rather
    // than picked — and the route's zod bound is what has to catch it.
    await expect(field).toHaveAttribute('max', /^\d{4}-\d{2}-\d{2}$/);
    await field.fill('2099-01-01');

    await expect(authedPage.locator('.detail__date-error')).toBeVisible();

    await authedPage.locator('.detail__date-done').click();
    await expect(authedPage.locator('.detail__said')).toHaveText(
      `said ${SAID_AT_LABEL} edit`,
    );

    await authedPage.reload();
    await expect(authedPage.locator('.detail__said')).toHaveText(
      `said ${SAID_AT_LABEL} edit`,
    );
  });

  // Both specs hold the write open, and page.route cannot see a request the
  // service worker owns — sw.js registers every same-origin /api/* — so with
  // the PWA installed the handler would silently never fire and the
  // assertions below would pass against a healthy round trip.
  test.describe('while the write is still in flight', () => {
    test.use({ serviceWorkers: 'block' });

    test('a date picked straight back is the one the word keeps', async ({
      authedPage,
    }) => {
      const entryId = await createEntry(authedPage, { word: 'appo' });
      await dateEntry(authedPage, entryId, SAID_AT);

      await authedPage.goto(`/entries/${entryId}`);
      const field = await openTheEditor(authedPage);

      const sent: string[] = [];
      const first = Promise.withResolvers<void>();
      await authedPage.route(`**/api/entries/${entryId}`, async (route) => {
        if (route.request().method() !== 'PATCH') {
          await route.fallback();
          return;
        }
        const body = route.request().postDataJSON() as { saidAt: string };
        sent.push(body.saidAt);
        if (sent.length === 1) await first.promise;
        await route.continue();
      });

      await field.fill(CORRECTED);
      await expect.poll(() => sent).toEqual([CORRECTED]);

      // The correction was a mistake, undone before the first write landed.
      // The entry still carries the old day at this moment, so a screen
      // comparing the pick against THAT sends nothing and lets the first
      // write win. The revert waits its turn instead — two writes in flight
      // at once could reach the row in either order.
      await field.fill(SAID_AT);
      await authedPage.waitForTimeout(300);
      expect(sent).toEqual([CORRECTED]);

      first.resolve();
      await expect.poll(() => sent).toEqual([CORRECTED, SAID_AT]);

      await authedPage.locator('.detail__date-done').click();
      await expect(authedPage.locator('.detail__said')).toHaveText(
        `said ${SAID_AT_LABEL} edit`,
      );
      // The screen and the row have to agree — a reordered pair would leave
      // the reader looking at the date they chose over the one that stuck.
      await authedPage.reload();
      await expect(authedPage.locator('.detail__said')).toHaveText(
        `said ${SAID_AT_LABEL} edit`,
      );
    });

    test('reopening the editor does not undo the pick', async ({
      authedPage,
    }) => {
      const entryId = await createEntry(authedPage, { word: 'appo' });
      await dateEntry(authedPage, entryId, SAID_AT);

      await authedPage.goto(`/entries/${entryId}`);
      const field = await openTheEditor(authedPage);

      const sent: string[] = [];
      const write = Promise.withResolvers<void>();
      await authedPage.route(`**/api/entries/${entryId}`, async (route) => {
        if (route.request().method() !== 'PATCH') {
          await route.fallback();
          return;
        }
        const body = route.request().postDataJSON() as { saidAt: string };
        sent.push(body.saidAt);
        await write.promise;
        await route.continue();
      });

      await field.fill(CORRECTED);
      await expect.poll(() => sent).toEqual([CORRECTED]);

      // Done and straight back in, before the answer. The entry still reads
      // the old day, so an editor that reopens on THAT would present the
      // correction as never made — and hand the write in flight an older
      // date to chase.
      await authedPage.locator('.detail__date-done').click();
      await authedPage.locator('.detail__said-body').click();
      await expect(field).toHaveValue(CORRECTED);

      write.resolve();
      await authedPage.locator('.detail__date-done').click();
      await expect(authedPage.locator('.detail__said')).toHaveText(
        `said ${CORRECTED_LABEL} edit`,
      );
      expect(sent).toEqual([CORRECTED]);
    });

    test('a refused date is reported after done was tapped', async ({
      authedPage,
    }) => {
      const entryId = await createEntry(authedPage, { word: 'appo' });
      await dateEntry(authedPage, entryId, SAID_AT);

      await authedPage.goto(`/entries/${entryId}`);
      const field = await openTheEditor(authedPage);

      const write = Promise.withResolvers<void>();
      await authedPage.route(`**/api/entries/${entryId}`, async (route) => {
        if (route.request().method() !== 'PATCH') {
          await route.fallback();
          return;
        }
        await write.promise;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{}',
        });
      });

      await field.fill(CORRECTED);
      await authedPage.locator('.detail__date-done').click();
      await expect(authedPage.locator('.detail__said-body')).toBeVisible();

      // The error line lives inside the editor, so a failure arriving after
      // it closed has nowhere to render: closing must not be able to turn a
      // refused date into a change that quietly never happened.
      write.resolve();
      await expect(authedPage.locator('.detail__date-error')).toBeVisible();
      await expect(authedPage.locator('.detail__date-field')).toHaveValue(
        CORRECTED,
      );
    });
  });
});
