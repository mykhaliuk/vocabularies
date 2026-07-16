import { expect, test } from '@playwright/test';

// VKB-20/21: per-locale prerendered landings (/, /fr, /uk) and the
// Accept-Language entry redirect on `/` (server middleware in the Node
// preview; mirrored as Vercel edge routes in prod — see ADR-0006).

test.describe('localized landing pages', () => {
  test('/fr serves the French landing with fr head metadata', async ({
    page,
  }) => {
    await page.goto('/fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'façon de parler',
    );
    await expect(
      page.getByRole('button', { name: 'recevoir mon lien de connexion' }),
    ).toBeVisible();
    await expect(
      page.locator('link[rel="alternate"][hreflang="uk"]'),
    ).toHaveAttribute('href', /\/uk$/);
  });

  test('/uk serves the Ukrainian landing with uk head metadata', async ({
    page,
  }) => {
    await page.goto('/uk');
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'насправді',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/uk$/,
    );
  });
});

test.describe('entry locale redirect', () => {
  test.describe('french browser', () => {
    test.use({ locale: 'fr-FR' });

    test('first visit to / lands on /fr', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/fr$/);
    });

    test('an explicit English choice wins over the browser language', async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: 'vocabu-locale', value: 'en', url: baseURL ?? '' },
      ]);
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test.describe('english browser', () => {
    test('stays on /', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    // Cookie is set before the first navigation: once the landing has been
    // visited the PWA service worker answers `/` from its precache and the
    // server-side redirect never gets a request.
    test('an explicit uk choice redirects to /uk', async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: 'vocabu-locale', value: 'uk', url: baseURL ?? '' },
      ]);
      await page.goto('/');
      await expect(page).toHaveURL(/\/uk$/);
    });
  });
});
