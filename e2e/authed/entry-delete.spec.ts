import { clickUntil, expect, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

const createEntry = async (page: Page, data: Record<string, unknown>) => {
  const created = await page.request.post('/api/entries', { data });
  expect(created.status()).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: string } };
  return entry.id;
};

const stillThere = async (page: Page, entryId: string) => {
  const res = await page.request.get(`/api/entries/${entryId}`);
  return res.status();
};

const openMenu = async (page: Page) => {
  const menu = page.locator('.actions__menu');
  await clickUntil(page.getByRole('button', { name: /more actions/i }), () =>
    expect(menu).toBeVisible({ timeout: 1000 }),
  );
  return menu;
};

// Until this resolves, a feed link is a native document navigation rather than
// the router's (e2e/authed/README.md on clickUntil).
const settleHydration = async (page: Page) => {
  const sheet = page.locator('.compose--open');
  await clickUntil(page.getByRole('button', { name: /new word/i }), () =>
    expect(sheet).toBeVisible({ timeout: 1000 }),
  );
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await expect(sheet).toBeHidden();
};

const openConfirm = async (page: Page) => {
  await openMenu(page);
  await page.getByRole('menuitem', { name: /delete/i }).click();
  const sheet = page.locator('.confirm--open');
  await expect(sheet).toBeVisible();
  return sheet;
};

const resolved = (target: Locator) =>
  target.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return { background: style.backgroundColor, foreground: style.color };
  });

const luminance = (colour: string) => {
  const parts = colour.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  const channels = parts.slice(0, 3).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
};

const contrast = (a: string, b: string) => {
  const first = luminance(a);
  const second = luminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
};

test.describe('deleting a word (authed)', () => {
  test('the ⋯ only asks — the first tap destroys nothing', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);

    await openMenu(authedPage);
    await expect(authedPage.getByRole('menuitem')).toHaveCount(2);

    await authedPage.getByRole('menuitem', { name: /delete/i }).click();

    await expect(authedPage.locator('.confirm--open')).toBeVisible();
    expect(await stillThere(authedPage, entryId)).toBe(200);
    await expect(authedPage.locator('.actions__menu')).toHaveCount(0);
  });

  test('tapping the page dismisses the menu, without acting on it', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'appo',
      story: 'The nap before you get mean.',
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openMenu(authedPage);

    // backdrop-filter on the bar makes it the containing block for fixed
    // descendants, so an in-bar scrim would be 54px tall, not the viewport.
    // Non-null first: optional-chaining both sides would compare undefined to
    // undefined and pass.
    const viewport = authedPage.viewportSize();
    const scrim = await authedPage.locator('.actions__scrim').boundingBox();
    expect(viewport).not.toBeNull();
    expect(scrim).not.toBeNull();
    if (!viewport || !scrim) return;
    expect(Math.abs(scrim.height - viewport.height)).toBeLessThanOrEqual(1);

    const toggle = authedPage.locator('.detail__toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const target = await toggle.boundingBox();
    expect(target).not.toBeNull();
    if (!target) return;
    await authedPage.mouse.click(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );

    await expect(authedPage.locator('.actions__menu')).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await authedPage.getByRole('button', { name: /more actions/i }).click();
    await expect(authedPage.locator('.actions__menu')).toBeVisible();
  });

  test('cancel leaves the word exactly where it was', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);

    const sheet = await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /^cancel$/i }).click();

    await expect(sheet).toHaveCount(0);
    await expect(authedPage).toHaveURL(new RegExp(`/entries/${entryId}$`));
    await expect(authedPage.locator('.detail__word')).toBeVisible();
    expect(await stillThere(authedPage, entryId)).toBe(200);
  });

  test('tabbing out closes the menu, so it stops eating arrow keys', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await openMenu(authedPage);

    // Off "edit word" and onto "delete…" — still the menu's own, so it stays.
    await authedPage.keyboard.press('Tab');
    await expect(authedPage.locator('.actions__menu')).toHaveCount(1);

    await authedPage.keyboard.press('Tab');
    await expect(authedPage.locator('.actions__menu')).toHaveCount(0);
  });

  test('the confirm takes the keyboard with it, and gives it back', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await openConfirm(authedPage);

    const cancel = authedPage.getByRole('button', { name: /^cancel$/i });
    await expect(cancel).toBeFocused();
    await expect(
      authedPage.getByRole('button', { name: /delete word/i }),
    ).not.toBeFocused();

    // Reachable by Shift+Tab, this would open its menu under the sheet's scrim.
    const trigger = authedPage.getByRole('button', { name: /more actions/i });
    await expect(trigger).toBeDisabled();

    await authedPage.keyboard.press('Escape');
    await expect(authedPage.locator('.confirm--open')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('the sentence names what actually goes with the word', async ({
    authedPage,
  }) => {
    const withVoice = await createEntry(authedPage, {
      word: 'bapple',
      story: 'She pointed at the fruit bowl every morning for a week.',
      media: { contentType: 'audio/mp4', sizeBytes: 40_000 },
    });
    const withStory = await createEntry(authedPage, {
      word: 'hangry-nap',
      story: 'The nap before you get mean.',
    });
    const bare = await createEntry(authedPage, { word: 'appo' });

    const cases = [
      {
        id: withVoice,
        word: 'bapple',
        reads:
          "Let this one go? Its story and the voice go with it. There's no " +
          'getting it back.',
      },
      {
        id: withStory,
        word: 'hangry-nap',
        reads:
          "Let this one go? Its story goes with it. There's no getting it " +
          'back.',
      },
      {
        id: bare,
        word: 'appo',
        reads: "Let this one go? There's no getting it back.",
      },
    ];

    for (const one of cases) {
      await authedPage.goto(`/entries/${one.id}`);
      await openConfirm(authedPage);
      await expect(authedPage.locator('.confirm__body')).toHaveText(one.reads);
      await expect(authedPage.locator('.confirm__word')).toHaveText(
        `“${one.word}”`,
      );
      await authedPage.getByRole('button', { name: /^cancel$/i }).click();
    }
  });

  test('the feed grows no per-entry affordance of its own', async ({
    authedPage,
  }) => {
    await createEntry(authedPage, { word: 'appo' });
    await authedPage.reload();

    await expect(authedPage.locator('.entry')).toHaveCount(1);
    await expect(
      authedPage.getByRole('button', { name: /more actions/i }),
    ).toHaveCount(0);
    await expect(authedPage.getByRole('menuitem')).toHaveCount(0);
  });

  test('a word that never loaded offers no ⋯, and the bar stays centred', async ({
    authedPage,
  }) => {
    await authedPage.goto('/entries/00000000-0000-4000-8000-000000000000');
    await expect(
      authedPage.locator('.detail__state').getByRole('heading'),
    ).toBeVisible();

    await expect(
      authedPage.getByRole('button', { name: /more actions/i }),
    ).toHaveCount(0);

    const bar = await authedPage.locator('.top-bar').boundingBox();
    const title = await authedPage.locator('.top-bar__title').boundingBox();
    expect(bar).not.toBeNull();
    expect(title).not.toBeNull();
    if (!bar || !title) return;
    const barCentre = bar.x + bar.width / 2;
    const titleCentre = title.x + title.width / 2;
    expect(Math.abs(barCentre - titleCentre)).toBeLessThanOrEqual(1);
  });

  test('the last word leaves the empty state behind it', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);

    await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /delete word/i }).click();

    await expect(authedPage).toHaveURL(/\/feed$/);
    await expect(authedPage.locator('.empty')).toBeVisible();
    await expect(authedPage.locator('.entry')).toHaveCount(0);
    expect(await stillThere(authedPage, entryId)).toBe(404);
  });

  test('a cold-opened word leaves nothing behind the OS back button', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);

    await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /delete word/i }).click();
    await expect(authedPage).toHaveURL(/\/feed$/);

    // A push reaches /feed too, so the destination alone proves nothing.
    const behind = await authedPage.evaluate(
      () => (window.history.state as { back?: string | null } | null)?.back,
    );
    expect(behind ?? null).toBeNull();
  });
});

// page.route cannot see a request the service worker owns, and sw.js claims
// every same-origin /api/* (service-worker/sw.js).
test.describe('when the network answers differently', () => {
  test.use({ serviceWorkers: 'block' });

  test('the feed drops the word even when its own reload is stale', async ({
    authedPage,
  }) => {
    const doomed = await createEntry(authedPage, { word: 'appo' });
    await createEntry(authedPage, { word: 'bapple' });

    const before = await authedPage.request.get('/api/entries');
    const stale = await before.text();
    expect(stale).toContain(doomed);

    // A cold goto would render the feed on the server, where its fetch never
    // leaves Nitro and the stub below could not fire.
    await authedPage.reload();
    await settleHydration(authedPage);

    let servedStale = 0;
    await authedPage.route(
      (url) => url.pathname === '/api/entries' && url.search === '',
      async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        servedStale += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stale,
        });
      },
    );

    await authedPage.getByRole('link', { name: /appo/ }).click();
    await expect(authedPage).toHaveURL(/\/entries\//);
    await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /delete word/i }).click();
    await expect(authedPage).toHaveURL(/\/feed$/);

    // Nuxt flips the URL before the feed's fetch resolves, so the counter has
    // to be read after something the stubbed page rendered.
    await expect(
      authedPage.getByRole('link', { name: /bapple/ }),
    ).toBeVisible();
    expect(servedStale).toBeGreaterThan(0);

    await expect(authedPage.getByRole('link', { name: /appo/ })).toHaveCount(0);
  });

  test('a delete that fell over says so and keeps the word', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await authedPage.route(`**/api/entries/${entryId}`, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: '{}',
          })
        : route.continue(),
    );

    const sheet = await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /delete word/i }).click();

    await expect(sheet.getByRole('alert')).toContainText(
      /couldn't delete this word/,
    );
    await expect(authedPage).toHaveURL(new RegExp(`/entries/${entryId}$`));
    await expect(sheet).toBeVisible();
  });

  test('a word someone else already deleted is not an error', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await authedPage.route(`**/api/entries/${entryId}`, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: '{}',
          })
        : route.continue(),
    );

    await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /delete word/i }).click();

    await expect(authedPage).toHaveURL(/\/feed$/);
    await expect(authedPage.getByRole('alert')).toHaveCount(0);
  });
});

// Resolved colours, not token names: `var(--danger)` would satisfy any
// name-shaped assertion and still print 2.67:1 on the button in the dark.
test.describe('the two terracottas, seen in the dark', () => {
  test.use({ colorScheme: 'dark' });

  test('the confirm button clears AA where --danger would not', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await openConfirm(authedPage);

    const button = authedPage.getByRole('button', { name: /delete word/i });
    const dark = await resolved(button);
    expect(contrast(dark.background, dark.foreground)).toBeGreaterThanOrEqual(
      4.5,
    );

    await authedPage.emulateMedia({ colorScheme: 'light' });
    const light = await resolved(button);
    expect(light.background).toBe(dark.background);
  });

  test('the menu item re-themes instead of staying light', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await openMenu(authedPage);

    const item = authedPage.getByRole('menuitem', { name: /delete/i });
    const dark = await resolved(item);
    await authedPage.emulateMedia({ colorScheme: 'light' });
    const light = await resolved(item);

    expect(dark.foreground).toMatch(/^rgb/);
    expect(dark.foreground).not.toBe(light.foreground);
  });
});
