import { expect, openCompose, test } from './fixtures';
import type { Page } from '@playwright/test';

// The dismiss half of VKB-154. The upload phases need MinIO and are covered by
// tests/unit/media-upload.test.ts instead; what runs here is everything a
// discard does without storage — the confirm, and the delete that follows a
// cancel while the entry is being created.

const write = async (page: Page, word: string) => {
  await page.locator('#compose-word').fill(word);
};

const confirmSheet = (page: Page) => page.locator('.discard--open');

const countEntries = async (page: Page) => {
  const res = await page.request.get('/api/entries');
  const { entries } = (await res.json()) as { entries: unknown[] };
  return entries.length;
};

test.describe('dismissing the compose sheet (authed)', () => {
  test('an empty sheet closes without asking anything', async ({
    authedPage,
  }) => {
    const sheet = await openCompose(authedPage);

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await expect(sheet).toBeHidden();
    await expect(confirmSheet(authedPage)).toHaveCount(0);
  });

  test('a written word is never dropped on the first tap', async ({
    authedPage,
  }) => {
    const sheet = await openCompose(authedPage);
    await write(authedPage, 'bapple');

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await expect(confirmSheet(authedPage)).toBeVisible();
    await expect(sheet).toBeVisible();
  });

  test('keeping editing gives the word back untouched', async ({
    authedPage,
  }) => {
    await openCompose(authedPage);
    await write(authedPage, 'bapple');
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await authedPage.getByRole('button', { name: /keep editing/i }).click();

    await expect(confirmSheet(authedPage)).toHaveCount(0);
    await expect(authedPage.locator('#compose-word')).toHaveValue('bapple');
    await expect(authedPage.locator('.compose--open')).toBeVisible();
  });

  test('discarding closes the sheet and keeps no word', async ({
    authedPage,
  }) => {
    const sheet = await openCompose(authedPage);
    await write(authedPage, 'bapple');
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await authedPage.getByRole('button', { name: /^discard$/i }).click();

    await expect(sheet).toBeHidden();
    expect(await countEntries(authedPage)).toBe(0);
  });

  test('the scrim asks before it throws anything away', async ({
    authedPage,
  }) => {
    const sheet = await openCompose(authedPage);
    await write(authedPage, 'bapple');

    await authedPage
      .locator('.compose__scrim')
      .click({ position: { x: 5, y: 5 } });

    await expect(confirmSheet(authedPage)).toBeVisible();
    await expect(sheet).toBeVisible();
  });

  test('escape asks, and escaping again only closes the question', async ({
    authedPage,
  }) => {
    await openCompose(authedPage);
    await write(authedPage, 'bapple');

    await authedPage.keyboard.press('Escape');
    await expect(confirmSheet(authedPage)).toBeVisible();

    await authedPage.keyboard.press('Escape');

    await expect(confirmSheet(authedPage)).toHaveCount(0);
    await expect(authedPage.locator('.compose--open')).toBeVisible();
  });

  test('a chosen speaker is content too, so it asks', async ({
    authedPage,
  }) => {
    const made = await authedPage.request.post('/api/speakers', {
      data: { name: 'Mira', rel: 'my daughter' },
    });
    expect(made.ok()).toBe(true);
    await authedPage.reload();

    const sheet = await openCompose(authedPage);
    await authedPage.locator('.chips__chip', { hasText: 'Mira' }).click();
    await expect(authedPage.locator('.chips__chip--active')).toBeVisible();

    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await expect(confirmSheet(authedPage)).toBeVisible();
    await expect(sheet).toBeVisible();
  });

  test('the question takes the keyboard away from the sheet behind it', async ({
    authedPage,
  }) => {
    await openCompose(authedPage);
    await write(authedPage, 'bapple');
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await expect(
      authedPage.getByRole('button', { name: /keep editing/i }),
    ).toBeFocused();
    await expect(authedPage.locator('.compose__sheet')).toHaveAttribute(
      'inert',
      '',
    );
  });
});

// The entry POST is the only irreversible step, so a cancel that lands while
// it is in flight is the case worth proving end to end: the client cannot roll
// the server back, it can only delete what the server already made.
test.describe('cancelling while the word is being created', () => {
  // page.route cannot see a request the service worker owns, and sw.js claims
  // every same-origin /api/* (service-worker/sw.js).
  test.use({ serviceWorkers: 'block' });

  test('deletes the entry the server had already committed', async ({
    authedPage,
  }) => {
    let createdId = '';
    await authedPage.route('**/api/entries', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = await response.text();
      createdId = (JSON.parse(body) as { entry: { id: string } }).entry.id;
      // Held long enough for the cancel below to happen first.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({ response, body });
    });

    await openCompose(authedPage);
    await write(authedPage, 'bapple');
    await authedPage.getByRole('button', { name: /^keep$/i }).click();

    await expect(
      authedPage.getByRole('button', { name: /keeping/i }),
    ).toBeVisible();
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await authedPage.getByRole('button', { name: /^discard$/i }).click();
    await expect(authedPage.locator('.compose--open')).toBeHidden();

    expect(createdId).not.toBe('');
    await expect
      .poll(
        async () => {
          const res = await authedPage.request.get(`/api/entries/${createdId}`);
          return res.status();
        },
        { timeout: 15000 },
      )
      .toBe(404);
  });

  test('a word that lands mid-question does not answer it', async ({
    authedPage,
  }) => {
    let createdId = '';
    await authedPage.route('**/api/entries', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = await response.text();
      createdId = (JSON.parse(body) as { entry: { id: string } }).entry.id;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({ response, body });
    });

    await openCompose(authedPage);
    await write(authedPage, 'landed-under-the-question');
    await authedPage.getByRole('button', { name: /^keep$/i }).click();
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await expect(confirmSheet(authedPage)).toBeVisible();

    // The keep completes here. It must not close the question, navigate, or
    // decide on the user's behalf.
    await authedPage.waitForTimeout(4000);
    await expect(confirmSheet(authedPage)).toBeVisible();
    await expect(authedPage).toHaveURL(/\/feed$/);

    await authedPage.getByRole('button', { name: /^discard$/i }).click();
    await expect(authedPage.locator('.compose--open')).toBeHidden();

    expect(createdId).not.toBe('');
    await expect
      .poll(
        async () => {
          const res = await authedPage.request.get(`/api/entries/${createdId}`);
          return res.status();
        },
        { timeout: 15000 },
      )
      .toBe(404);
  });
});
