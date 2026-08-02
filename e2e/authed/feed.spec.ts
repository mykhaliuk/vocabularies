import { clickUntil, expect, test } from './fixtures';

// First authed spec (VKB-101) — it doubles as the proof that the harness
// works: sign-in, an authed screen rendering server data, a hydrated
// interaction, and a hop between two guarded routes.
test.describe('feed (authed)', () => {
  test('signing in lands on the feed with the empty state', async ({
    authedPage,
  }) => {
    await expect(authedPage).toHaveURL(/\/feed$/);
    await expect(
      authedPage.getByRole('heading', { name: /no words yet/i }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole('button', { name: /new word/i }),
    ).toBeVisible();
  });

  test('a kept word renders on the feed', async ({ authedPage }) => {
    // Seeded through the API on the page's own (authenticated) context, so
    // the assertion is about the feed rendering server state — the compose
    // sheet's write path has its own coverage.
    const created = await authedPage.request.post('/api/entries', {
      data: { word: 'nana-lella', gloss: 'grandma' },
    });
    expect(created.status()).toBe(201);

    await authedPage.reload();
    const card = authedPage.locator('.entry', { hasText: 'nana-lella' });
    await expect(card).toBeVisible();
    await expect(card.locator('.entry__gloss')).toHaveText('grandma');
    // No speaker attributed: the card reads as the user's own word.
    await expect(card.locator('.entry__speaker')).toHaveText('You');
  });

  test('the compose sheet opens once the shell has hydrated', async ({
    authedPage,
  }) => {
    const sheet = authedPage.locator('.compose--open');
    await clickUntil(
      authedPage.getByRole('button', { name: /new word/i }),
      () => expect(sheet).toBeVisible({ timeout: 1000 }),
    );
  });

  test('a tab hop stays inside the authed shell', async ({ authedPage }) => {
    await authedPage.getByRole('link', { name: /^profile$/i }).click();
    await expect(authedPage).toHaveURL(/\/profile$/);
    await expect(
      authedPage.getByRole('heading', { name: /^profile$/i }),
    ).toBeVisible();
  });
});
