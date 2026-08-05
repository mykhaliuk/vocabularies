import { clickUntil, expect, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// Deleting your own word from the ⋯ menu on the detail screen (VKB-95,
// entry-actions-spec.html). Everything is seeded through the API on the page's
// own authenticated context.

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

// The trigger is JS-driven, so an early click lands before Vue attaches the
// listener. It toggles, so a retry after a click that DID land closes the menu
// again — but clickUntil re-checks after every click, so that iteration simply
// fails and the next one re-opens it. What matters for clickUntil is the other
// condition: the menu must not cover its own trigger, or every retry would
// time out on actionability instead.
const openMenu = async (page: Page) => {
  const menu = page.locator('.actions__menu');
  await clickUntil(page.getByRole('button', { name: /more actions/i }), () =>
    expect(menu).toBeVisible({ timeout: 1000 }),
  );
  return menu;
};

// Vue hydrates on top of server-rendered markup, so a feed card is clickable
// before its listener exists — and a link followed then is a native document
// navigation, which would make the hop under test the browser's rather than the
// router's. The compose FAB is the repo's usual probe (e2e/authed/README.md).
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

// Resolved colours, never token names: `var(--danger)` satisfies a name
// assertion while printing whatever it likes on either theme.
const resolved = (target: Locator) =>
  target.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return { background: style.backgroundColor, foreground: style.color };
  });

// WCAG relative luminance, so the contrast claim in theme-light.css is checked
// rather than trusted.
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
    // One item today: edit ships behind a flag until VKB-110 gives it a
    // destination, and a menu that grew a live "edit word" here would be an
    // affordance opening nothing.
    await expect(authedPage.getByRole('menuitem')).toHaveCount(1);

    await authedPage.getByRole('menuitem', { name: /delete/i }).click();

    // The ellipsis on "delete…" is a promise: a confirm follows, and the word
    // is untouched until it is answered. Wiring the item straight to the
    // DELETE would still show a plausible screen — only this GET catches it.
    await expect(authedPage.locator('.confirm--open')).toBeVisible();
    expect(await stillThere(authedPage, entryId)).toBe(200);
    // ...and the menu is gone rather than stacked behind the sheet.
    await expect(authedPage.locator('.actions__menu')).toHaveCount(0);
  });

  // The scrim is teleported to <body>, and that is the whole test: the top bar
  // carries a backdrop-filter, which makes it the containing block for every
  // fixed descendant. Left inside the bar, `inset: 0` resolves to its 54px —
  // the scrim covers the one strip nobody taps to dismiss, and then sits on
  // top of the ⋯ so even that cannot close the menu again.
  test('tapping the page dismisses the menu, without acting on it', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'appo',
      story: 'The nap before you get mean.',
    });
    await authedPage.goto(`/entries/${entryId}`);
    await openMenu(authedPage);

    // Both sides proved non-null BEFORE they are compared. Optional-chaining
    // them instead would make a renamed `.actions__scrim` read as
    // `expect(undefined).toBe(undefined)` — green while asserting nothing, on
    // the one test whose entire purpose is that the scrim is not 53px tall.
    const viewport = authedPage.viewportSize();
    const scrim = await authedPage.locator('.actions__scrim').boundingBox();
    expect(viewport).not.toBeNull();
    expect(scrim).not.toBeNull();
    if (!viewport || !scrim) return;
    // Tolerance rather than equality: sub-pixel layout and device scale factor
    // move this by fractions. The bug was 53px against 844, so ±1 keeps every
    // bit of the signal and none of the brittleness.
    expect(Math.abs(scrim.height - viewport.height)).toBeLessThanOrEqual(1);

    // Aimed at a real control, because a scrim that dismisses is only half of
    // it: the tap must be swallowed rather than also folding the story away.
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

    // ...and the ⋯ is reachable again straight away, which the in-bar scrim
    // was covering.
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

  test('tabbing out of the menu closes it', async ({ authedPage }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await openMenu(authedPage);

    // Left standing, the window-level arrow handling keeps calling
    // preventDefault() and yanking focus back into a menu the reader has
    // already walked away from — it would steal arrow-key scrolling outright.
    await authedPage.keyboard.press('Tab');
    await expect(authedPage.locator('.actions__menu')).toHaveCount(0);
  });

  test('the confirm takes the keyboard with it, and gives it back', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.goto(`/entries/${entryId}`);
    await openConfirm(authedPage);

    // A sheet that opens with Delete under the keyboard turns one stray Enter
    // into a lost keepsake.
    const cancel = authedPage.getByRole('button', { name: /^cancel$/i });
    await expect(cancel).toBeFocused();
    await expect(
      authedPage.getByRole('button', { name: /delete word/i }),
    ).not.toBeFocused();

    // The ⋯ lives in the bar at z-index 20 and the sheet sits at 60, so a
    // trigger still reachable by Shift+Tab would open its menu UNDERNEATH the
    // scrim — focus inside something the reader cannot see.
    const trigger = authedPage.getByRole('button', { name: /more actions/i });
    await expect(trigger).toBeDisabled();

    // Escape releases the sheet and hands focus back, rather than dropping it
    // on <body> and making a keyboard reader restart from the top.
    await authedPage.keyboard.press('Escape');
    await expect(authedPage.locator('.confirm--open')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  // The middle sentence is assembled from what the entry actually has (spec
  // §The surfaces). Whole strings, because a generic warning would satisfy any
  // toContainText fragment — and the bare word is the case that proves the
  // assembly, since it must omit the clause rather than soften it.
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
      // The word itself does the emotional work, so a sheet asking about a
      // different one is the worst failure available here.
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

    // "The feed stays a reading surface" is a decision, not an omission: the
    // whole reason the actions live one screen deeper.
    await expect(authedPage.locator('.entry')).toHaveCount(1);
    await expect(
      authedPage.getByRole('button', { name: /more actions/i }),
    ).toHaveCount(0);
    await expect(authedPage.getByRole('menuitem')).toHaveCount(0);
  });

  test('a word the screen never loaded offers no ⋯ to act with', async ({
    authedPage,
  }) => {
    await authedPage.goto('/entries/00000000-0000-4000-8000-000000000000');
    await expect(
      authedPage.locator('.detail__state').getByRole('heading'),
    ).toBeVisible();

    await expect(
      authedPage.getByRole('button', { name: /more actions/i }),
    ).toHaveCount(0);

    // ...and the bar's own spacer is what keeps the title centred once the ⋯
    // is not there to balance the back arrow. Geometry, because the title
    // stays perfectly readable while sitting visibly off-centre.
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
    // A pasted link or a refresh: nothing of ours sits behind this word, so
    // the delete has to invent the feed as its destination.
    await authedPage.goto(`/entries/${entryId}`);

    await openConfirm(authedPage);
    await authedPage.getByRole('button', { name: /delete word/i }).click();
    await expect(authedPage).toHaveURL(/\/feed$/);

    // REPLACE, not push. A push reaches the feed too, and parks a word that no
    // longer exists behind the OS back button forever — the destination alone
    // cannot tell the two apart.
    const behind = await authedPage.evaluate(
      () => (window.history.state as { back?: string | null } | null)?.back,
    );
    expect(behind ?? null).toBeNull();
  });
});

// Both blocks below need page.route, and page.route cannot see a request the
// service worker owns — sw.js registers every same-origin /api/* as a
// NetworkFirst, so with the PWA installed the fulfilment would silently never
// fire and these would pass against the healthy path they are meant to rule
// out.
test.describe('when the network answers differently', () => {
  test.use({ serviceWorkers: 'block' });

  test('the feed drops the word even when its own reload is stale', async ({
    authedPage,
  }) => {
    const doomed = await createEntry(authedPage, { word: 'appo' });
    await createEntry(authedPage, { word: 'bapple' });

    // The feed exactly as it stands BEFORE the delete — both words in it.
    const before = await authedPage.request.get('/api/entries');
    const stale = await before.text();
    expect(stale).toContain(doomed);

    // Reached through a hydrated feed, so returning is the ROUTER's navigation
    // and the feed's reload is a browser request page.route can answer. A cold
    // goto would render the feed on the server, where the fetch never leaves
    // Nitro and the stub below would silently never fire.
    await authedPage.reload();
    await settleHydration(authedPage);

    // Exactly the feed's own first page, so the detail's `/api/entries/:id`
    // and any cursor page still reach the server untouched.
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

    // Waited on FIRST: Nuxt flips the URL before the feed's own fetch resolves,
    // so asserting the counter straight after toHaveURL would read it before
    // the stub had any chance to fire — and pass this test for the one reason
    // it exists to rule out. The un-deleted word is what proves the stale page
    // rendered at all.
    await expect(
      authedPage.getByRole('link', { name: /bapple/ }),
    ).toBeVisible();
    expect(servedStale).toBeGreaterThan(0);

    // The feed's reload handed back a list that still contains the deleted
    // word, so its absence here is the client's own removal signal and nothing
    // else: drop that, and the word walks straight back into the feed.
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

    // Saying nothing would read exactly like a deletion that worked, and the
    // reader would leave believing the word is gone.
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

    // Another tab, or another device, got there first. The word is gone, which
    // is what the tap asked for — reporting a failure would be a lie about an
    // outcome the reader already has.
    await expect(authedPage).toHaveURL(/\/feed$/);
    await expect(authedPage.getByRole('alert')).toHaveCount(0);
  });
});

// The two terracotta marks the spec allows, checked as resolved colour: the
// menu item re-themes (a foreground), the confirm button does not (a fill that
// has to clear AA with white on both). `var(--danger)` on the button would
// satisfy every name-shaped assertion and print 2.67:1 in the dark.
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

    // Theme-independent by design, exactly like --primary-action: the button
    // surface IS the colour, so it must not lighten with the theme.
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

    // A foreground on a dark surface has to lift; --danger does, which is the
    // whole reason it is the wrong token for the fill above.
    expect(dark.foreground).toMatch(/^rgb/);
    expect(dark.foreground).not.toBe(light.foreground);
  });
});
