import { expect, openCompose, test } from './fixtures';
import type { Page } from '@playwright/test';

// Resolves a token the same way the page does. Asserting against a px number
// instead would fail the next time the design system rescales.
const step = (page: Page, token: string) =>
  page.evaluate((name) => {
    const host = document.createElement('div');
    // An unresolvable var() leaves font-size inherited, so a probe hanging off
    // the body would read the very value a broken call site falls back to.
    // Parking it under an implausible size tells the two apart.
    host.style.fontSize = '7px';
    const probe = document.createElement('span');
    probe.style.fontSize = `var(${name})`;
    host.append(probe);
    document.body.append(host);
    const size = getComputedStyle(probe).fontSize;
    host.remove();
    return size;
  }, token);

// At the default 16px root every rem step equals the px literal it replaced,
// so a declaration reverted to `14px` would still match its token. Skewing the
// root breaks the tie: the token moves with it, a literal does not.
const SKEWED_ROOT = '20px';
const skewRoot = (page: Page) =>
  page.evaluate((size) => {
    document.documentElement.style.fontSize = size;
  }, SKEWED_ROOT);

test('the compose sheet sizes its chrome from the type scale', async ({
  authedPage,
}) => {
  await authedPage.goto('/feed');
  await openCompose(authedPage);
  await skewRoot(authedPage);

  const base = await step(authedPage, '--text-base');
  const sm = await step(authedPage, '--text-sm');

  await expect(authedPage.locator('.compose__title')).toHaveCSS(
    'font-size',
    base,
  );
  await expect(authedPage.locator('#compose-gloss')).toHaveCSS(
    'font-size',
    base,
  );
  await expect(authedPage.locator('.chips__chip--new')).toHaveCSS(
    'font-size',
    sm,
  );
});

test('the empty feed sizes its copy from the type scale', async ({
  authedPage,
}) => {
  await authedPage.goto('/feed');
  await skewRoot(authedPage);

  await expect(authedPage.locator('.empty__subtitle')).toHaveCSS(
    'font-size',
    await step(authedPage, '--text-base'),
  );
});
