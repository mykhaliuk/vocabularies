import { expect, settleHydration, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// The word detail screen, read half (VKB-108). Everything here is seeded
// through the API on the page's own authenticated context, so the assertions
// are about the screen rendering server state.

// The spec's own worked example, pinned so the date and the frozen age are
// facts rather than whatever today happens to be: Mira was 19 months old on
// 8 April 2026. POST /api/entries has no saidAt — PATCH does — so the entry
// is created and then dated.
//
// April and a single-digit day are chosen, not incidental: May is the one
// month whose `short` and `long` names are the same string, and a two-digit
// day renders identically under `numeric` and `2-digit`. Here every part of
// the format is a different string when it is wrong.
const SAID_AT = '2026-04-08';
const SAID_AT_LABEL = '8 Apr 2026';
const BIRTHDAY = '2024-09-04';
const AGE_LABEL = '19 mo';

// Playwright has no "assert this never happens". The honest form is to wait
// for the navigation with a budget a real one would never need, and require
// the wait to run out — "no navigation", not "no navigation within 300ms",
// which an async path would slip through.
const NO_NAV_BUDGET_MS = 3_000;

const openedTheWord = (page: Page) =>
  page
    .waitForURL(/\/entries\//, { timeout: NO_NAV_BUDGET_MS })
    .then(() => true)
    .catch(() => false);

const createEntry = async (page: Page, data: Record<string, unknown>) => {
  const created = await page.request.post('/api/entries', { data });
  expect(created.status()).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: string } };
  return entry.id;
};

const createSpeaker = async (page: Page, data: Record<string, unknown>) => {
  const created = await page.request.post('/api/speakers', { data });
  expect(created.status()).toBe(201);
  const { speaker } = (await created.json()) as { speaker: { id: string } };
  return speaker.id;
};

const fontSize = (target: Locator) =>
  target.evaluate((el) => window.getComputedStyle(el).fontSize);

// Resolved colours, never token names: `var(--rose-200)` satisfies a name
// assertion and still prints the same pink on both themes.
const discColours = (disc: Locator) =>
  disc.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return { background: style.backgroundColor, foreground: style.color };
  });

// The detail's own fetch only leaves the browser on a CLIENT-side
// navigation: a cold `goto` renders the word on the server, where the
// request never reaches page.route at all. So these specs hydrate the feed
// first, arm the route, and then tap the card.
const failEntryRequest = (page: Page, entryId: string, status: number) =>
  page.route(`**/api/entries/${entryId}`, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: '{}' }),
  );

const holdEntryRequest = async (page: Page, entryId: string) => {
  const gate = Promise.withResolvers<void>();
  await page.route(`**/api/entries/${entryId}`, async (route) => {
    await gate.promise;
    await route.continue();
  });
  return gate;
};

const dateEntry = async (page: Page, entryId: string, saidAt: string) => {
  const patched = await page.request.patch(`/api/entries/${entryId}`, {
    data: { saidAt },
  });
  expect(patched.status()).toBe(200);
};

test.describe('word detail (authed)', () => {
  test('a feed card opens the word it belongs to', async ({ authedPage }) => {
    await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
    });

    await authedPage.reload();
    // The headword is a real link — reachable by keyboard, and the click
    // needs no hydration retry.
    await authedPage.getByRole('link', { name: /bapple/ }).click();

    await expect(authedPage).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
    await expect(
      authedPage.getByRole('heading', { name: /bapple/ }),
    ).toBeVisible();
    await expect(authedPage.locator('.detail__gloss')).toHaveText(
      'apple, but rounder',
    );
    // No speaker attributed: the word is the user's own.
    await expect(authedPage.locator('.detail__meta')).toHaveText('You');
    // The bar names the SCREEN, not the entry — the word itself is never
    // truncated, and a 54px bar could only ellipsise it.
    await expect(authedPage.locator('.top-bar__title')).toHaveText('word');
    // The detail carries no bottom chrome — that is the whole reason its
    // scroll container got its air back.
    await expect(authedPage.locator('.bottom-nav')).toHaveCount(0);
  });

  test('the card is reachable without a mouse', async ({ authedPage }) => {
    await createEntry(authedPage, { word: 'appo' });
    await authedPage.reload();

    // A real link, so it takes focus and Enter follows it — no hydration
    // needed, which is exactly why the headword carries the affordance
    // rather than a keydown handler on the card.
    const link = authedPage.locator('.entry__link');
    await link.focus();
    await expect(link).toBeFocused();
    await link.press('Enter');
    await expect(authedPage).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  });

  test('tapping the media does not open the word', async ({ authedPage }) => {
    // Play is play (prototype feed.jsx:140). The media declaration leaves the
    // row 'processing', which is enough: the guard is on the block, not on a
    // particular player state.
    await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder',
      media: { contentType: 'audio/mp4', sizeBytes: 40_000 },
    });

    await authedPage.reload();
    await settleHydration(authedPage);

    await authedPage.locator('.media-block').click();
    expect(await openedTheWord(authedPage)).toBe(false);
    await expect(authedPage).toHaveURL(/\/feed$/);

    // ...while the card AROUND it still opens the word — this is the tap the
    // ticket is about, and it is the click handler rather than the link.
    await authedPage.locator('.entry__gloss').click();
    await expect(authedPage).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  });

  test('selecting text on a card does not open the word', async ({
    authedPage,
    isMobile,
  }) => {
    // Drag-selection is a pointer affordance; touch emulation produces no
    // selection from a mouse drag (phones select by long-press), so this
    // guard is desktop's to hold.
    test.skip(isMobile, 'drag selection needs a mouse pointer');

    await createEntry(authedPage, {
      word: 'bapple',
      gloss: 'apple, but rounder, and worth quoting to someone else',
    });

    await authedPage.reload();
    await settleHydration(authedPage);

    // A real drag: mousedown, move, mouseup — which also fires a click on the
    // card. That click is the end of a selection, not a tap, and answering it
    // with a navigation would throw away the words just highlighted.
    const gloss = authedPage.locator('.entry__gloss');
    const box = await gloss.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const midY = box.y + box.height / 2;
    await authedPage.mouse.move(box.x + 3, midY);
    await authedPage.mouse.down();
    await authedPage.mouse.move(box.x + box.width - 3, midY, { steps: 12 });
    await authedPage.mouse.up();

    const selected = await authedPage.evaluate(
      () => window.getSelection()?.toString() ?? '',
    );
    expect(selected.length).toBeGreaterThan(0);

    expect(await openedTheWord(authedPage)).toBe(false);
    await expect(authedPage).toHaveURL(/\/feed$/);
  });

  // The said-on date is formatted in UTC on purpose: saidAt is a plain
  // calendar day, and a negative-offset reader must not be shown the one
  // before. That pin is untestable from UTC — which is where both CI
  // (ubuntu-latest) and the Node SSR pass run, so deleting `timeZone: 'UTC'`
  // would stay green everywhere while shipping exactly the bug the code
  // comment says it prevents. This block is the reader on the other side of
  // the Atlantic.
  test.describe('the said-on date, seen from UTC-7', () => {
    test.use({ timezoneId: 'America/Los_Angeles' });

    test('the speaker, story, collection and date all render', async ({
      authedPage,
    }) => {
      const speakerId = await createSpeaker(authedPage, {
        name: 'Mira',
        rel: 'my daughter',
        birthday: BIRTHDAY,
      });
      const entryId = await createEntry(authedPage, {
        word: 'bapple',
        sid: speakerId,
        story: 'She pointed at the fruit bowl every morning for a week.',
        collection: "Mira's words",
      });
      await dateEntry(authedPage, entryId, SAID_AT);

      // A cold `goto` would race hydration instead of testing it: the date
      // renders once, server-side, in Node's own UTC — accidentally correct
      // even with the bug this block exists to catch — and toHaveText below
      // would happily match that sample before the client ever mounts.
      // Reaching the word through a settled feed (the same barrier the back
      // spec uses) makes the render entirely client-side, so what the
      // assertions see is the LA-side computed, not a pre-hydration sample.
      await authedPage.reload();
      await settleHydration(authedPage);
      await authedPage.getByRole('link', { name: /bapple/ }).click();
      await expect(authedPage).toHaveURL(/\/entries\//);

      // Whole lines, not fragments: order and composition are the point. The
      // metaline is name · relation · age, the age frozen against the day the
      // word was said rather than measured from today.
      await expect(authedPage.locator('.detail__meta')).toHaveText(
        `Mira · my daughter · ${AGE_LABEL}`,
      );
      await expect(authedPage.locator('.detail__said')).toHaveText(
        `said ${SAID_AT_LABEL} · ${AGE_LABEL} edit`,
      );
      await expect(authedPage.locator('.detail__chip')).toHaveText(
        "Mira's words",
      );
      await expect(authedPage.locator('.detail__story')).toContainText(
        'fruit bowl',
      );
    });

    test('a word with no speaker still says when it was said', async ({
      authedPage,
    }) => {
      const entryId = await createEntry(authedPage, { word: 'appo' });
      await dateEntry(authedPage, entryId, SAID_AT);

      // Same hydration barrier as the test above: reach the word through a
      // settled feed so the render under test is client-side, not a sample
      // that might land during the SSR-to-hydration race.
      await authedPage.reload();
      await settleHydration(authedPage);
      await authedPage.getByRole('link', { name: /appo/ }).click();
      await expect(authedPage).toHaveURL(/\/entries\//);

      // No birthday to freeze, so the age half of the line is absent — and the
      // date reads day-month-year in English too, not the US order a bare `en`
      // tag would pick.
      await expect(authedPage.locator('.detail__said')).toHaveText(
        `said ${SAID_AT_LABEL} edit`,
      );
    });
  });

  test('the headword ladder drives both screens', async ({ authedPage }) => {
    // TWO rungs, not one: a single word at the ladder's top step is also
    // what you get from clamping every headword to that step, so one word
    // pins nothing but the ceiling. Sizes are pinned as well as compared,
    // so deleting the :style binding from BOTH templates cannot agree its
    // way to green (utils/headword-size.ts).
    const ladder = [
      { word: 'bapple', sizePx: '56px' }, // 6 chars → top step
      { word: 'bapple sandwiches', sizePx: '46px' }, // 17 chars → second step
    ];

    for (const rung of ladder) {
      await createEntry(authedPage, { word: rung.word });
    }
    await authedPage.reload();

    for (const rung of ladder) {
      // Exact, because "bapple" is a prefix of the other word.
      const link = authedPage.getByRole('link', {
        name: `“${rung.word}”`,
        exact: true,
      });
      const card = authedPage.locator('.entry').filter({ has: link });
      const onCard = await fontSize(card.locator('.entry__word'));

      await link.click();
      await expect(authedPage).toHaveURL(/\/entries\//);
      const onDetail = await fontSize(authedPage.locator('.detail__word'));

      expect(onCard).toBe(rung.sizePx);
      expect(onDetail).toBe(onCard);

      await authedPage.goto('/feed');
    }
  });

  test('the story unfold opens by default and folds back', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'hangry-nap',
      story: 'The nap before you get mean.',
    });

    await authedPage.goto(`/entries/${entryId}`);

    const story = authedPage.locator('.detail__story');
    await expect(story).toBeVisible();

    const toggle = authedPage.locator('.detail__toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The toggle is JS-driven and safe to click twice only in pairs, so the
    // hydration wait is on the attribute rather than a click retry.
    await expect(async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false', {
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });
    await expect(story).toHaveCount(0);
  });

  test('a word with no story offers no toggle', async ({ authedPage }) => {
    const entryId = await createEntry(authedPage, {
      word: "don't trust a quiet dog",
    });

    await authedPage.goto(`/entries/${entryId}`);

    await expect(
      authedPage.getByRole('heading', { name: /quiet dog/ }),
    ).toBeVisible();
    await expect(authedPage.locator('.detail__toggle')).toHaveCount(0);
    await expect(authedPage.locator('.detail__chip')).toHaveCount(0);
    // The date is one of the three blocks that are always there.
    await expect(authedPage.locator('.detail__said')).toBeVisible();
  });

  test('back returns to the feed', async ({ authedPage }) => {
    await createEntry(authedPage, { word: 'appo' });

    await authedPage.reload();
    // This spec is ABOUT the router's history, so the navigation that
    // creates it has to be the router's. A link clicked before hydration is
    // a native document navigation: `history.state.back` would be null, the
    // bar's cold branch would run, and the failure would read "the back
    // arrow pushed instead of going back" — a diagnosis pointing at the
    // opposite defect.
    await settleHydration(authedPage);
    await authedPage.getByRole('link', { name: /appo/ }).click();
    await expect(authedPage).toHaveURL(/\/entries\//);
    const wordPath = new URL(authedPage.url()).pathname;

    // Click only while still on the detail: toPass re-runs the whole
    // callback, and a second click after a slow-but-correct navigation would
    // land on /feed, where there is no back button — turning a slow pass
    // into a hard failure (e2e/authed/README.md on clickUntil).
    const back = authedPage.getByRole('button', { name: /back/i });
    await expect(async () => {
      if (new URL(authedPage.url()).pathname.startsWith('/entries/')) {
        await back.click();
      }
      await expect(authedPage).toHaveURL(/\/feed$/, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    // The destination alone proves nothing: a fresh push to /feed lands on
    // the same URL while quietly growing the stack. A real back leaves the
    // word ahead of us, exactly where it was.
    const ahead = await authedPage.evaluate(
      () =>
        (window.history.state as { forward?: string | null } | null)?.forward,
    );
    expect(ahead).toBe(wordPath);
  });

  test('a word opened cold leaves nothing behind the OS back button', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });

    // Straight to the word — a pasted link, a refresh, a notification. There
    // is no entry of ours behind this one, so the bar's arrow has to invent
    // the feed as its destination.
    await authedPage.goto(`/entries/${entryId}`);

    const back = authedPage.getByRole('button', { name: /back/i });
    await expect(async () => {
      if (new URL(authedPage.url()).pathname.startsWith('/entries/')) {
        await back.click();
      }
      await expect(authedPage).toHaveURL(/\/feed$/, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    // The destination alone proves nothing: a push reaches the feed too, and
    // parks the word behind the OS back button forever. An "up" affordance
    // replaces, so nothing of ours is left in the stack.
    const behind = await authedPage.evaluate(
      () => (window.history.state as { back?: string | null } | null)?.back,
    );
    expect(behind ?? null).toBeNull();

    await authedPage.goBack();
    await expect(authedPage).not.toHaveURL(/\/entries\//);
  });

  test('an entry that is not there says so, without a retry', async ({
    authedPage,
  }) => {
    await authedPage.goto('/entries/00000000-0000-4000-8000-000000000000');
    // By ROLE, not by class: the one line of copy IS the page's heading, and
    // a dead link must not land a screen-reader user on a headingless page.
    await expect(
      authedPage.locator('.detail__state').getByRole('heading'),
    ).toContainText(/isn't here any more/);
    // No name filter: a control offering a retry under different words is
    // the same bug, and the state block holds nothing else.
    await expect(authedPage.locator('.detail__state button')).toHaveCount(0);
    // The bar still names the screen where there is no entry to name.
    await expect(authedPage.locator('.top-bar__title')).toHaveText('word');
  });

  test('an id that is not a uuid gets an answer, not a retry', async ({
    authedPage,
  }) => {
    // The route validates `z.string().uuid()`, so this is a 400, not a 404 —
    // and a "try again" here would re-issue the identical request forever.
    await authedPage.goto('/entries/not-a-uuid');
    await expect(
      authedPage.locator('.detail__state').getByRole('heading'),
    ).toContainText(/isn't here any more/);
    await expect(authedPage.locator('.detail__state button')).toHaveCount(0);
  });

  // What the screen says when the request does NOT come back with a word.
  // Both cases need page.route, and page.route cannot see a request the
  // service worker owns — sw.js registers every same-origin /api/* (a
  // NetworkFirst, and a NetworkOnly for /api/me), so with the PWA installed
  // the fulfilment would silently never fire. Both specs assert a FAILURE
  // state (a load-error heading with a visible retry; a redirect to
  // /login), so against the healthy load that would leave them with, they
  // would not pass — they would fail, loudly. Blocking the service worker
  // is what keeps that failure from being spurious.
  test.describe('when the request does not come back with a word', () => {
    test.use({ serviceWorkers: 'block' });

    test('a load that fell over offers a retry, and does not say gone', async ({
      authedPage,
    }) => {
      const entryId = await createEntry(authedPage, { word: 'appo' });

      await authedPage.reload();
      await settleHydration(authedPage);
      await failEntryRequest(authedPage, entryId, 500);

      await authedPage.getByRole('link', { name: /appo/ }).click();
      await expect(authedPage).toHaveURL(/\/entries\//);

      // A 500 says nothing about the word: it may be sitting there perfectly
      // well. Claiming it is gone would be a statement of fact we never
      // checked, and the retry is the whole difference between the branches.
      const state = authedPage.locator('.detail__state');
      await expect(state.getByRole('heading')).toContainText(
        /couldn't load this word/,
      );
      await expect(state.getByRole('heading')).not.toContainText(
        /isn't here any more/,
      );
      await expect(
        state.getByRole('button', { name: /try again/i }),
      ).toBeVisible();
    });

    test('a signed-out reader is sent to sign in, not told it is gone', async ({
      authedPage,
    }) => {
      const entryId = await createEntry(authedPage, { word: 'appo' });

      await authedPage.reload();
      await settleHydration(authedPage);
      // A session revoked from another device while the feed sat open. The
      // route guard cannot catch it: feed → word is a hop between two authed
      // routes, and the guard skips its probe there (middleware/auth.ts), so
      // the screen's own request is where the 401 lands. /api/me answers the
      // same way, which is what keeps /login from bouncing a reader it still
      // believes is signed in.
      await failEntryRequest(authedPage, entryId, 401);
      await authedPage.route('**/api/me', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: '{}',
        }),
      );

      await authedPage.getByRole('link', { name: /appo/ }).click();

      await expect(authedPage).toHaveURL(/\/login/);
      await expect(authedPage.locator('.detail__state')).toHaveCount(0);
    });
  });
});

// VKB-149: opening a word must not wait on its request. Each spec holds that
// request open. A blocking build changes the address but keeps the feed on
// screen while it is held, so only the loading assertion tells them apart.
test.describe('while the word is still loading', () => {
  test.use({ serviceWorkers: 'block' });

  test('a tapped word opens at once and fills in when it answers', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'appo',
      gloss: 'held back',
    });
    await authedPage.reload();
    await settleHydration(authedPage);
    const gate = await holdEntryRequest(authedPage, entryId);

    await authedPage.getByRole('link', { name: /appo/ }).click();

    await expect(authedPage).toHaveURL(new RegExp(`/entries/${entryId}$`));
    const loading = authedPage.locator('.detail__state[role="status"]');
    await expect(loading).toContainText(/loading this word/);
    await expect(authedPage.locator('.detail')).toHaveCount(0);

    gate.resolve();
    await expect(authedPage.locator('.detail__gloss')).toHaveText('held back');
    await expect(loading).toHaveCount(0);
  });

  test('a word deleted before it loaded says so, without a retry', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, { word: 'appo' });
    await authedPage.reload();
    await settleHydration(authedPage);
    await failEntryRequest(authedPage, entryId, 404);

    await authedPage.getByRole('link', { name: /appo/ }).click();

    await expect(authedPage).toHaveURL(/\/entries\//);
    await expect(
      authedPage.locator('.detail__state').getByRole('heading'),
    ).toContainText(/isn't here any more/);
    await expect(authedPage.locator('.detail__state button')).toHaveCount(0);
  });

  test('a direct load arrives with the word already rendered', async ({
    authedPage,
  }) => {
    const entryId = await createEntry(authedPage, {
      word: 'appo',
      gloss: 'held back',
    });

    // The server's HTML is the first paint: it must carry the word, never
    // the loading state a client-side navigation shows.
    const page = await authedPage.request.get(`/entries/${entryId}`);
    expect(page.status()).toBe(200);
    const html = await page.text();
    // Rendered elements, not bare strings: the payload also carries the
    // gloss, and inlined styles can carry the class names.
    expect(html).toMatch(/class="detail__gloss"[^>]*>held back</);
    expect(html).not.toMatch(
      /<div[^>]*class="detail__state"[^>]*role="status"/,
    );
  });
});

// tests/unit/avatar.test.ts pins the tone pair as token NAMES, and a name is
// exactly what `--rose-200` would satisfy too — that step keeps its light
// value under the dark selector, which is the entire argument in
// utils/avatar.ts for rejecting it. Only a resolved colour can tell a
// re-themed token from one that merely looks like a token.
test.describe('the speaker disc in the dark', () => {
  test.use({ colorScheme: 'dark' });

  test('a rose disc re-themes instead of staying light', async ({
    authedPage,
  }) => {
    // Tone is assigned server-side by cycling rose → blue → ink over how
    // many people the owner keeps (server/domain/speakers.ts), and the
    // fixture signs in a brand-new user — so the first speaker is rose.
    const speakerId = await createSpeaker(authedPage, { name: 'Mira' });
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      sid: speakerId,
    });

    await authedPage.goto(`/entries/${entryId}`);
    const disc = authedPage.locator('.detail .v-avatar');
    await expect(disc).toBeVisible();

    // The context is dark (test.use above), so this is the colour a
    // dark-theme reader actually gets.
    const dark = await discColours(disc);
    await authedPage.emulateMedia({ colorScheme: 'light' });
    const light = await discColours(disc);

    expect(dark.background).toMatch(/^rgb/);
    expect(dark.background).not.toBe(light.background);
    expect(dark.foreground).not.toBe(light.foreground);
  });
});

// The suite runs Desktop Chrome at 1280×720, which is exactly the viewport a
// mobile-first overflow bug hides from. Scoped to this block on purpose:
// re-configuring the whole suite is its own ticket.
test.describe('word detail on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('a long speaker line never scrolls the page sideways', async ({
    authedPage,
  }) => {
    // Both fields take 200 characters server-side; these are merely plausible.
    const name = 'Genevieve-Aurelia Montgomery-Fitzwilliam';
    const rel = 'my extremely patient next-door neighbour';
    const speakerId = await createSpeaker(authedPage, {
      name,
      rel,
      birthday: BIRTHDAY,
    });
    const entryId = await createEntry(authedPage, {
      word: 'bapple',
      sid: speakerId,
    });
    await dateEntry(authedPage, entryId, SAID_AT);

    await authedPage.goto(`/entries/${entryId}`);
    await expect(authedPage.locator('.detail__meta')).toContainText(name);

    // The metaline never wraps (spec §Anatomy step 1), so it must be clipped
    // instead — uncapped, one long line widens the centred column until the
    // whole document scrolls sideways.
    const document = await authedPage.evaluate(() => ({
      scrollWidth: window.document.documentElement.scrollWidth,
      clientWidth: window.document.documentElement.clientWidth,
    }));
    expect(document.scrollWidth).toBeLessThanOrEqual(document.clientWidth);
  });
});
