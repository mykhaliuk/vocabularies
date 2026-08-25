import { test as base, expect } from '@playwright/test';
import { watchPublicInternet } from './hermetic';

// The smoke suite's test: identical to Playwright's, plus the hermeticity
// guard — every context refuses the public internet and fails the test
// naming any URL that tried (VKB-123).
export const test = base.extend({
  page: async ({ page }, use) => {
    const assertHermetic = watchPublicInternet(page.context());
    await use(page);
    assertHermetic();
  },
});

export { expect };
