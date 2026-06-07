import { expect, test } from '@playwright/test';

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
});

test.describe('login', () => {
  test('submit stays disabled until the email is valid', async ({ page }) => {
    await page.goto('/login');
    const submit = page.getByRole('button', { name: /send me a link/i });
    const email = page.getByLabel(/your email/i);

    await expect(submit).toBeDisabled();
    await email.fill('not-an-email');
    await expect(submit).toBeDisabled();
    await email.fill('hi@example.com');
    await expect(submit).toBeEnabled();
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
