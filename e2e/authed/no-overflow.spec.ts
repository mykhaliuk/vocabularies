import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

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

  // Every authed screen: the four `middleware: 'auth'` pages, the account
  // settings screen (guards itself via its own /login redirect), and the
  // detail page for the entry created above.
  const screens = [
    '/feed',
    '/discover',
    '/profile',
    '/saved',
    '/me',
    `/entries/${entry.id}`,
  ];
  for (const screen of screens) {
    await authedPage.goto(screen);
    await expect(authedPage.locator('#__nuxt')).toBeVisible();
    expect(await overflowPx(authedPage), screen).toBeLessThanOrEqual(0);
  }
});
