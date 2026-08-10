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

// VKB-156. The hero submit never wraps its label, so a longer translation
// competes with the email field for the row — and the field loses silently,
// cutting its own placeholder mid-address with no ellipsis to show for it.
//
// The submit label is pinned because it is also an input to the measurement:
// its width is what squeezes the field (17 chars in en against 28-30 in
// fr/uk), so a shorter label would let the assertion pass for the wrong
// reason. The compose spec pins its placeholder instead — there it is the
// long locale-varying string, here it is 12-14 chars in every locale.
test.describe('the hero email field keeps room for an address', () => {
  for (const [path, locale, submit] of [
    ['/', 'en', 'get my login link'],
    ['/fr', 'fr', 'recevoir mon lien de connexion'],
    ['/uk', 'uk', 'отримати посилання для входу'],
  ] as const) {
    test(`at desktop width in ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 820 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.capture__submit')).toHaveText(submit);

      const field = page.locator('.field-row__input');
      const fits = await field.evaluate((el: HTMLInputElement) => {
        const cs = getComputedStyle(el);
        const hint = getComputedStyle(el, '::placeholder');
        const span = document.createElement('span');
        span.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-family:${hint.fontFamily};font-size:${hint.fontSize};font-weight:${hint.fontWeight};letter-spacing:${hint.letterSpacing}`;
        span.textContent = el.placeholder;
        document.body.append(span);
        const advance = span.getBoundingClientRect().width;
        span.remove();
        const room =
          el.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight);
        return { advance, room };
      });
      expect(fits.advance).toBeLessThan(fits.room);
    });
  }
});

test.describe('entry locale redirect', () => {
  test.describe('french browser', () => {
    test.use({ locale: 'fr-FR' });

    test('first visit to / lands on /fr', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/fr$/);
    });

    test('the redirect also fires for / with query params', async ({
      page,
    }) => {
      await page.goto('/?utm_source=e2e');
      await expect(page).toHaveURL(/\/fr/);
    });

    test('the nav locale switcher reaches English and persists it', async ({
      page,
      context,
    }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/fr$/);
      // The switcher's cookie write is a hydrated @click handler, so clicking
      // before hydration navigates without setting the cookie and bounces back
      // to /fr. Wait for the page to settle first — otherwise this is flaky
      // under parallel load.
      await page.waitForLoadState('networkidle');
      // Click "en" in the switcher: sets vocabu-locale=en, then navigates
      // to / — which must now stay English instead of bouncing back.
      await page.locator('.locale-switch__link[hreflang="en"]').click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      const cookies = await context.cookies();
      const locale = cookies.find((c) => c.name === 'vocabu-locale');
      expect(locale?.value).toBe('en');
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
