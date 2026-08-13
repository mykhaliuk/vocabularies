import { expect, openCompose, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// VKB-156. An <input> cuts a placeholder it cannot fit with no ellipsis and no
// scrollbar, so nothing in the DOM records the loss and no other check here
// would notice — this suite is the only thing standing between a longer
// translation and a hint the user never sees the end of.

const NARROWEST = { width: 375, height: 820 };

// Asserted, not just requested: without this a locale cookie that failed to
// apply would leave every case measuring the English string and passing.
const HINT = {
  en: 'e.g. Appo — or a whole saying',
  fr: 'ex. Appo — ou toute une expression',
  uk: 'напр. Appo — чи цілий вислів',
};

// Real layout, not canvas: a span carrying the pseudo-element's own resolved
// font. The Cyrillic Rubik subset only downloads once a Cyrillic glyph renders,
// which a canvas measurement would silently miss.
const placeholderAdvance = (field: Locator) =>
  field.evaluate((el: HTMLInputElement) => {
    const hint = getComputedStyle(el, '::placeholder');
    const span = document.createElement('span');
    span.style.cssText =
      `position:absolute;left:-9999px;white-space:pre;font-family:${hint.fontFamily};` +
      `font-size:${hint.fontSize};font-weight:${hint.fontWeight};letter-spacing:${hint.letterSpacing}`;
    span.textContent = el.placeholder;
    document.body.append(span);
    const width = span.getBoundingClientRect().width;
    span.remove();
    return width;
  });

const contentWidth = (field: Locator) =>
  field.evaluate((el: HTMLInputElement) => {
    const cs = getComputedStyle(el);
    return (
      el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    );
  });

// The sheet rises on a transform, so anything measured before it settles is
// measured against a moving box.
const openSettledCompose = async (page: Page) => {
  await openCompose(page);
  await page.waitForFunction(() => {
    const el = document.querySelector('.compose__sheet');
    if (!el) return false;
    const { m42 } = new DOMMatrix(getComputedStyle(el).transform);
    return m42 === 0;
  });
  await page.evaluate(() => document.fonts.ready);
};

for (const locale of ['en', 'fr', 'uk'] as const) {
  test(`the word hint fits its field in ${locale}`, async ({ authedPage }) => {
    await authedPage.setViewportSize(NARROWEST);
    await authedPage.context().addCookies([
      {
        name: 'vocabu-locale',
        value: locale,
        url: new URL(authedPage.url()).origin,
      },
    ]);
    await authedPage.goto('/feed');
    await openSettledCompose(authedPage);

    const field = authedPage.locator('#compose-word');
    await expect(field).toHaveAttribute('placeholder', HINT[locale]);
    expect(await placeholderAdvance(field)).toBeLessThan(
      await contentWidth(field),
    );
  });
}

test('the hint shrinks without touching the headword the field renders', async ({
  authedPage,
}) => {
  await authedPage.setViewportSize(NARROWEST);
  await authedPage.goto('/feed');
  await openSettledCompose(authedPage);
  const field = authedPage.locator('#compose-word');

  await expect(field).toHaveCSS('font-size', '26px');
  await expect(field).toHaveCSS('font-weight', '700');

  const empty = await field.boundingBox();
  await field.fill('nana-lella');
  expect(await field.boundingBox()).toEqual(empty);
});
