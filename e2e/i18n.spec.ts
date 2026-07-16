import { expect, test } from '@playwright/test';

// M10 verification: locale auto-detect via Accept-Language and the explicit
// choice persisting through the vocabu-locale cookie (strategy: no_prefix —
// no /fr URLs, rendering is entirely cookie/header driven).
//
// The landing copy is not localized yet (VKB-20), so /login is the assertion
// surface: it is fully translated and renders without DB/Redis/email.

const LOGIN_SUBMIT = {
  en: 'Send me a link',
  fr: 'Envoyez-moi un lien',
  uk: 'Надішліть мені посилання',
};

test.describe('locale auto-detect', () => {
  test.describe('french device', () => {
    test.use({ locale: 'fr-FR' });

    test('Accept-Language: fr renders the app in French', async ({ page }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('button', { name: LOGIN_SUBMIT.fr }),
      ).toBeVisible();
      await expect(page.getByLabel('Votre e-mail')).toBeVisible();
    });
  });

  test.describe('ukrainian device', () => {
    test.use({ locale: 'uk-UA' });

    test('Accept-Language: uk renders the app in Ukrainian', async ({
      page,
    }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('button', { name: LOGIN_SUBMIT.uk }),
      ).toBeVisible();
    });
  });

  test.describe('unsupported device locale', () => {
    test.use({ locale: 'de-DE' });

    test('falls back to English when the hint matches no locale', async ({
      page,
    }) => {
      await page.goto('/login');
      await expect(
        page.getByRole('button', { name: LOGIN_SUBMIT.en }),
      ).toBeVisible();
    });
  });
});

test.describe('locale switcher persistence', () => {
  test('switching to Ukrainian on /me sets the cookie and survives a reload', async ({
    page,
  }) => {
    // /me is session-gated and there is no DB in the e2e sandbox: an SSR
    // visit 401-redirects to /login before any browser-side mock can apply.
    // Mock /api/me and navigate client-side instead, so the fetch runs in
    // the page and the switcher UI is reachable end-to-end.
    await page.route('**/api/me', (route) =>
      route.fulfill({
        json: {
          email: 'e2e@example.com',
          displayName: 'E2E',
          hasAvatar: false,
        },
      }),
    );
    await page.goto('/login');
    // Vue attaches __vue_app__ to the mount container only once hydration
    // completes, which lands after the load event — wait for it.
    await page.waitForFunction(() => {
      const root = document.querySelector('#__nuxt');
      return root !== null && '__vue_app__' in root;
    });
    await page.evaluate(() => {
      // The router push is the only auth-free path onto /me.
      const root = document.querySelector('#__nuxt') as Element & {
        __vue_app__: {
          config: {
            globalProperties: { $router: { push(to: string): unknown } };
          };
        };
      };
      return root.__vue_app__.config.globalProperties.$router.push('/me');
    });

    const ukChip = page.getByRole('button', { name: 'Українська' });
    await expect(ukChip).toBeVisible();
    await ukChip.click();

    await expect(ukChip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Мова' })).toBeVisible();
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === 'vocabu-locale')?.value;
      })
      .toBe('uk');

    // Reload re-runs SSR: no session → back to /login. The cookie must win
    // there — the explicit choice persists across the reload.
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('button', { name: LOGIN_SUBMIT.uk }),
    ).toBeVisible();
  });

  test.describe('cookie beats Accept-Language', () => {
    test.use({ locale: 'fr-FR' });

    test('a saved uk locale wins over a French device', async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: 'vocabu-locale', value: 'uk', url: baseURL },
      ]);
      await page.goto('/login');
      await expect(
        page.getByRole('button', { name: LOGIN_SUBMIT.uk }),
      ).toBeVisible();
    });
  });
});
