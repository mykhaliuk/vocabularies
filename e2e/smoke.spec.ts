import type { Locator } from '@playwright/test';
import { expect, test } from '@playwright/test';

// Alpha of a computed CSS color. Chromium serializes computed colors as
// rgb(r, g, b), rgba(r, g, b, a), or color(srgb r g b [/ a]) — the alpha
// component is omitted whenever it equals 1.
const parseAlpha = (color: string): number => {
  const match = color.match(/^(rgba?|color)\(([^)]+)\)$/);
  if (!match) return Number.NaN;
  const [channels, alpha] = match[2].split('/').map((part) => part.trim());
  if (alpha !== undefined) return Number.parseFloat(alpha);
  const parts = channels.split(/[\s,]+/).filter(Boolean);
  const isLegacyRgba = match[1] !== 'color' && parts.length === 4;
  return isLegacyRgba ? Number.parseFloat(parts[3]) : 1;
};

test.describe('landing', () => {
  test('renders the hero, CTA, and key sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Vocabu/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /actually talk/i,
    );
    await expect(
      page.getByRole('button', { name: /get my login link/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /a keepsake, not a feed/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /two taps to keep a word/i }),
    ).toBeVisible();
  });

  // VKB-82: the disabled CTA used element opacity, so the hero gradient bled
  // through and the button looked different per locale (copy length moves it
  // across the gradient). The disabled state must stay fully opaque.
  test('disabled CTA is opaque so page art cannot bleed through', async ({
    page,
  }) => {
    await page.goto('/');
    const submit = page.getByRole('button', { name: /get my login link/i });
    await expect(submit).toBeDisabled();
    const styles = await submit.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, background: cs.backgroundColor };
    });
    expect(styles.opacity).toBe('1');
    expect(parseAlpha(styles.background)).toBe(1);
  });
});

test.describe('login', () => {
  test('submit stays disabled until the email is valid', async ({ page }) => {
    await page.goto('/login');
    // Wait for hydration to settle before typing: filling the input while Vue
    // is still attaching v-model loses the value on the hydration patch, which
    // makes this assertion flaky under parallel load. /login issues its session
    // probe from onMounted, so network-idle implies hydration has run.
    await page.waitForLoadState('networkidle');
    const submit = page.getByRole('button', { name: /send me a link/i });
    const email = page.getByLabel(/your email/i);

    await expect(submit).toBeDisabled();
    await email.fill('not-an-email');
    await expect(submit).toBeDisabled();
    await email.fill('hi@example.com');
    await expect(submit).toBeEnabled();
  });
});

// The landing is prerendered (ADR-0006) and the theme toggle hydrates as an
// island on top of it, so every button sits in the static HTML with no
// @click listener yet. Playwright's actionability checks (visible, stable,
// enabled, receives events) all pass on that dead markup, so a click racing
// hydration is dispatched and silently dropped — setThemeMode never runs.
// Waiting on `load` (goto's default) does not help: `load` means the scripts
// arrived, not that they executed. So re-issue the click until its own effect
// shows up. setThemeMode is idempotent, which makes a repeated click harmless.
//
// Confirming every step matters beyond the flake: clicking "system" cannot be
// confirmed on its own (an absent data-theme is also the pre-click state), so
// an unconfirmed earlier click would let the "system clears the override" test
// pass without ever setting an override.
const clickUntil = async (button: Locator, effect: () => Promise<void>) => {
  await expect(async () => {
    await button.click();
    await effect();
  }).toPass({ timeout: 15_000 });
};

test.describe('theme toggle', () => {
  test('light and dark set data-theme and persist to localStorage', async ({
    page,
  }) => {
    await page.goto('/');
    const html = page.locator('html');

    await clickUntil(page.getByRole('button', { name: /light theme/i }), () =>
      expect(html).toHaveAttribute('data-theme', 'light', { timeout: 1000 }),
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocabu-theme')))
      .toBe('light');

    await clickUntil(page.getByRole('button', { name: /dark theme/i }), () =>
      expect(html).toHaveAttribute('data-theme', 'dark', { timeout: 1000 }),
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocabu-theme')))
      .toBe('dark');
  });

  test('system clears the override and follows OS changes live', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const html = page.locator('html');

    // The override must be confirmed applied before "system" can be shown to
    // clear it — otherwise both assertions below hold trivially.
    await clickUntil(page.getByRole('button', { name: /dark theme/i }), () =>
      expect(html).toHaveAttribute('data-theme', 'dark', { timeout: 1000 }),
    );
    await clickUntil(page.getByRole('button', { name: /system theme/i }), () =>
      expect(html).not.toHaveAttribute('data-theme', /.+/, { timeout: 1000 }),
    );

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocabu-theme')))
      .toBeNull();

    const paperToken = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--paper')
          .trim(),
      );

    const lightPaper = await paperToken();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(paperToken).not.toBe(lightPaper);
    await expect(html).not.toHaveAttribute('data-theme', /.+/);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(paperToken).toBe(lightPaper);
  });
});

test.describe('offline route', () => {
  test('renders the offline page', async ({ page }) => {
    await page.goto('/offline');
    await expect(
      page.getByRole('heading', { name: /you're offline/i }),
    ).toBeVisible();
  });
});

test.describe('not found', () => {
  test('serves the branded 404 with a 404 status', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/not in the dictionary/i)).toBeVisible();
  });
});

test.describe('app shell guard', () => {
  // VKB-65: the tab pages sit behind the auth middleware. Without a session
  // cookie /api/me answers 401 before touching any infra, so the negative
  // case is CI-testable with no database.
  test('unauthenticated /feed redirects to /login', async ({ page }) => {
    await page.goto('/feed');
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('button', { name: /send me a link/i }),
    ).toBeVisible();
  });
});
