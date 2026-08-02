import { clickUntil, expect, test } from './fixtures';

// The word detail screen, read half (VKB-108). Everything here is seeded
// through the API on the page's own authenticated context, so the assertions
// are about the screen rendering server state.
test.describe('word detail (authed)', () => {
  test('a feed card opens the word it belongs to', async ({ authedPage }) => {
    const created = await authedPage.request.post('/api/entries', {
      data: { word: 'bapple', gloss: 'apple, but rounder' },
    });
    expect(created.status()).toBe(201);

    await authedPage.reload();
    // The headword is a real link — reachable by keyboard, and the click
    // needs no hydration retry.
    await authedPage.getByRole('link', { name: /bapple/ }).click();

    await expect(authedPage).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
    await expect(
      authedPage.getByRole('heading', { name: /bapple/ }),
    ).toBeVisible();
    await expect(authedPage.locator('.detail__gloss')).toHaveText(
      'apple, but rounder',
    );
    // No speaker attributed: the word is the user's own.
    await expect(authedPage.locator('.detail__meta')).toHaveText('You');
    // The detail carries no bottom chrome — that is the whole reason its
    // scroll container got its air back.
    await expect(authedPage.locator('.bottom-nav')).toHaveCount(0);
  });

  test('the card is reachable without a mouse', async ({ authedPage }) => {
    const created = await authedPage.request.post('/api/entries', {
      data: { word: 'appo' },
    });
    expect(created.status()).toBe(201);
    await authedPage.reload();

    // A real link, so it takes focus and Enter follows it — no hydration
    // needed, which is exactly why the headword carries the affordance
    // rather than a keydown handler on the card.
    const link = authedPage.locator('.entry__link');
    await link.focus();
    await expect(link).toBeFocused();
    await link.press('Enter');
    await expect(authedPage).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  });

  test('tapping the media does not open the word', async ({ authedPage }) => {
    // Play is play (prototype feed.jsx:140). The media declaration leaves the
    // row 'processing', which is enough: the guard is on the block, not on a
    // particular player state.
    const created = await authedPage.request.post('/api/entries', {
      data: {
        word: 'bapple',
        gloss: 'apple, but rounder',
        media: { contentType: 'audio/mp4', sizeBytes: 40_000 },
      },
    });
    expect(created.status()).toBe(201);

    await authedPage.reload();

    // Hydration has to be established FIRST, or this asserts nothing: before
    // Vue attaches listeners, a click on the card does not navigate either,
    // and the test would pass for the wrong reason. The compose FAB is the
    // repo's usual probe — its effect is visible and it is safe to re-click.
    const sheet = authedPage.locator('.compose--open');
    await clickUntil(
      authedPage.getByRole('button', { name: /new word/i }),
      () => expect(sheet).toBeVisible({ timeout: 1000 }),
    );
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    await expect(sheet).toBeHidden();

    await authedPage.locator('.media-block').click();
    await authedPage.waitForTimeout(300);
    await expect(authedPage).toHaveURL(/\/feed$/);

    // ...while the card AROUND it still opens the word — this is the tap the
    // ticket is about, and it is the click handler rather than the link.
    await authedPage.locator('.entry__gloss').click();
    await expect(authedPage).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  });

  test('the speaker, story, collection and date all render', async ({
    authedPage,
  }) => {
    const speaker = await authedPage.request.post('/api/speakers', {
      data: { name: 'Mira', rel: 'my daughter', birthday: '2024-09-14' },
    });
    expect(speaker.status()).toBe(201);
    const { speaker: created } = (await speaker.json()) as {
      speaker: { id: string };
    };

    const entry = await authedPage.request.post('/api/entries', {
      data: {
        word: 'bapple',
        sid: created.id,
        story: 'She pointed at the fruit bowl every morning for a week.',
        collection: "Mira's words",
      },
    });
    expect(entry.status()).toBe(201);
    const { entry: kept } = (await entry.json()) as { entry: { id: string } };

    await authedPage.goto(`/entries/${kept.id}`);

    // name · relation · age — the age frozen against the day it was said.
    await expect(authedPage.locator('.detail__meta')).toContainText('Mira');
    await expect(authedPage.locator('.detail__meta')).toContainText(
      'my daughter',
    );
    await expect(authedPage.locator('.detail__chip')).toHaveText(
      "Mira's words",
    );
    await expect(authedPage.locator('.detail__said')).toContainText('said');
    await expect(authedPage.locator('.detail__story')).toContainText(
      'fruit bowl',
    );
  });

  test('the story unfold opens by default and folds back', async ({
    authedPage,
  }) => {
    const entry = await authedPage.request.post('/api/entries', {
      data: { word: 'hangry-nap', story: 'The nap before you get mean.' },
    });
    expect(entry.status()).toBe(201);
    const { entry: kept } = (await entry.json()) as { entry: { id: string } };

    await authedPage.goto(`/entries/${kept.id}`);

    const story = authedPage.locator('.detail__story');
    await expect(story).toBeVisible();

    const toggle = authedPage.locator('.detail__toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The toggle is JS-driven and safe to click twice only in pairs, so the
    // hydration wait is on the attribute rather than a click retry.
    await expect(async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false', {
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });
    await expect(story).toHaveCount(0);
  });

  test('a word with no story offers no toggle', async ({ authedPage }) => {
    const entry = await authedPage.request.post('/api/entries', {
      data: { word: "don't trust a quiet dog" },
    });
    expect(entry.status()).toBe(201);
    const { entry: kept } = (await entry.json()) as { entry: { id: string } };

    await authedPage.goto(`/entries/${kept.id}`);

    await expect(
      authedPage.getByRole('heading', { name: /quiet dog/ }),
    ).toBeVisible();
    await expect(authedPage.locator('.detail__toggle')).toHaveCount(0);
    await expect(authedPage.locator('.detail__chip')).toHaveCount(0);
    // The date is one of the three blocks that are always there.
    await expect(authedPage.locator('.detail__said')).toBeVisible();
  });

  test('back returns to the feed', async ({ authedPage }) => {
    const entry = await authedPage.request.post('/api/entries', {
      data: { word: 'appo' },
    });
    expect(entry.status()).toBe(201);

    await authedPage.reload();
    await authedPage.getByRole('link', { name: /appo/ }).click();
    await expect(authedPage).toHaveURL(/\/entries\//);

    // Click only while still on the detail: toPass re-runs the whole
    // callback, and a second click after a slow-but-correct navigation would
    // land on /feed, where there is no back button — turning a slow pass
    // into a hard failure (e2e/authed/README.md on clickUntil).
    const back = authedPage.getByRole('button', { name: /back/i });
    await expect(async () => {
      if (new URL(authedPage.url()).pathname.startsWith('/entries/')) {
        await back.click();
      }
      await expect(authedPage).toHaveURL(/\/feed$/, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });

  test('an entry that is not there says so, without a retry', async ({
    authedPage,
  }) => {
    await authedPage.goto('/entries/00000000-0000-4000-8000-000000000000');
    await expect(authedPage.locator('.detail__state-msg')).toContainText(
      /isn't here any more/,
    );
    await expect(
      authedPage.getByRole('button', { name: /try again/i }),
    ).toHaveCount(0);
  });
});
