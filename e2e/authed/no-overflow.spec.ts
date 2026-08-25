import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// The structural guard VKB-114 asked for: no authed screen may scroll
// horizontally, at either project's viewport. This is the assertion that
// catches the VKB-108 class of defect (a forced 3000px column) that no
// element-level spec ever looks at.
const overflowPx = (page: Page) =>
  page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });

test('no authed screen scrolls horizontally', async ({ authedPage }) => {
  const created = await authedPage.request.post('/api/entries', {
    data: { word: 'bapple', gloss: 'apple, but rounder' },
  });
  expect(created.status()).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: string } };

  const screens = [
    '/feed',
    '/discover',
    '/profile',
    '/saved',
    `/entries/${entry.id}`,
  ];
  for (const screen of screens) {
    await authedPage.goto(screen);
    await expect(authedPage.locator('#__nuxt')).toBeVisible();
    expect(await overflowPx(authedPage), screen).toBeLessThanOrEqual(0);
  }
});
