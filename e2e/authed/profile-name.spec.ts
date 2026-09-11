import { expect, settleHydration, test } from './fixtures';

// VKB-94: the display name is editable from /me and feeds the greeting.

const NEW_NAME = 'Калабуня';

test('renames the account from the profile page', async ({ authedPage }) => {
  await authedPage.goto('/me');
  const input = authedPage.locator('.name-input');
  const save = authedPage.locator('.name-save');

  await expect(input).toBeVisible();
  await expect(save).toBeDisabled();

  // The save button enables only once Vue has seen the input event, so
  // re-filling until it does doubles as the hydration gate.
  await expect(async () => {
    await input.fill(NEW_NAME);
    await expect(save).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await save.click();
  await expect(authedPage.locator('h1')).toContainText(NEW_NAME);
  // Not getByRole('status'): the app shell keeps an always-present (empty)
  // toast live region with the same role. Content, not visibility: the
  // status element itself is always in the DOM.
  await expect(authedPage.locator('.name-status')).toHaveText(/\S/);

  await authedPage.reload();
  await expect(authedPage.locator('h1')).toContainText(NEW_NAME);
  await expect(authedPage.locator('.name-input')).toHaveValue(NEW_NAME);
});

// VKB-149: account settings must not wait on /api/me. /me declares no route
// guard, so the page's own request is the only one the hold below catches.
test.describe('while the profile is still loading', () => {
  test.use({ serviceWorkers: 'block' });

  test('account settings open at once and fill in when the profile answers', async ({
    authedPage,
  }) => {
    await authedPage.goto('/profile');
    await settleHydration(authedPage);
    const gate = Promise.withResolvers<void>();
    await authedPage.route('**/api/me', async (route) => {
      await gate.promise;
      await route.continue();
    });

    await authedPage.getByRole('link', { name: /account settings/i }).click();

    await expect(authedPage).toHaveURL(/\/me$/);
    const loading = authedPage.locator('.me-loading');
    await expect(loading).toContainText(/loading your profile/);

    gate.resolve();
    await expect(authedPage.locator('h1')).toContainText(/hello/i);
    await expect(loading).toHaveCount(0);
  });

  test('a session that ended while it loaded goes to sign in', async ({
    authedPage,
  }) => {
    await authedPage.goto('/profile');
    await settleHydration(authedPage);
    await authedPage.route('**/api/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{}',
      }),
    );

    await authedPage.getByRole('link', { name: /account settings/i }).click();

    await expect(authedPage).toHaveURL(/\/login/);
  });
});
