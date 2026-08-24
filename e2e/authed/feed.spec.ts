import { clickUntil, expect, settleHydration, test } from './fixtures';

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

  // VKB-144: navigating to the feed must not block on /api/entries. The spec
  // holds that request open indefinitely; on a blocking build the feed's
  // content never appears and every assertion below times out. On the fixed
  // build the cached words render immediately and the refresh runs in the
  // background behind a progress indicator.
  test.describe('while /api/entries hangs', () => {
    // The service worker proxies same-origin /api/* (network-first), and
    // requests it forwards bypass page.route — the hold below would never
    // engage and the spec would pass against a still-broken build.
    test.use({ serviceWorkers: 'block' });

    test('a return to the feed shows cached words before the API answers', async ({
      authedPage,
    }) => {
      const created = await authedPage.request.post('/api/entries', {
        data: { word: 'slow-poke', gloss: 'held back' },
      });
      expect(created.status()).toBe(201);

      await authedPage.reload();
      const card = authedPage.locator('.entry', { hasText: 'slow-poke' });
      await expect(card).toBeVisible();

      // The feed-tab click below must be a CLIENT-side navigation: before
      // hydration the same click is a full page load, which the route hold
      // cannot see (SSR fetches /api/entries in-process), and the spec would
      // pass against a still-broken build.
      await settleHydration(authedPage);

      await authedPage.getByRole('link', { name: /^profile$/i }).click();
      await expect(authedPage).toHaveURL(/\/profile$/);

      const gate = Promise.withResolvers<void>();
      await authedPage.route('**/api/entries*', async (route) => {
        await gate.promise;
        await route.continue();
      });

      await authedPage.getByRole('link', { name: /^feed$/i }).click();

      // /api/entries is still pending here — the gate is closed — so
      // whatever is on screen came from the client-side cache, not from
      // the network.
      await expect(authedPage).toHaveURL(/\/feed$/);
      await expect(card).toBeVisible();
      await expect(authedPage.getByRole('progressbar')).toBeVisible();

      gate.resolve();
      await expect(authedPage.getByRole('progressbar')).toBeHidden();
      await expect(card).toBeVisible();
    });
  });

  // The reseed half of VKB-144: when the revisit's background refresh lands,
  // it must reconcile with the cached list — replace the first-page window it
  // covers — not overwrite it, or every page the user pulled in via "show
  // more" silently vanishes a beat after the feed renders.
  test('a background refresh keeps the pages the user already loaded', async ({
    authedPage,
  }) => {
    // 25 entries: page one is 20, "show more" pulls the last 5.
    for (let index = 1; index <= 25; index++) {
      const created = await authedPage.request.post('/api/entries', {
        data: { word: `word-${String(index).padStart(2, '0')}` },
      });
      expect(created.status()).toBe(201);
    }

    await authedPage.reload();
    await settleHydration(authedPage);

    await authedPage.getByRole('button', { name: /show more/i }).click();
    await expect(authedPage.locator('.entry')).toHaveCount(25);

    await authedPage.getByRole('link', { name: /^profile$/i }).click();
    await expect(authedPage).toHaveURL(/\/profile$/);
    await authedPage.getByRole('link', { name: /^feed$/i }).click();
    await expect(authedPage).toHaveURL(/\/feed$/);

    // All 25 render from the cache at once; once the refresh has landed (the
    // bar is gone), the paged-in tail must still be there.
    await expect(authedPage.locator('.entry')).toHaveCount(25);
    await expect(authedPage.getByRole('progressbar')).toBeHidden();
    await expect(authedPage.locator('.entry')).toHaveCount(25);
  });
});
