import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// ADR-0015. Splitting these fails silently: everything still builds and
// caches, the toast simply never appears.
const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const sw = read('service-worker/sw.js');
const nuxtConfig = read('nuxt.config.js');
const appVue = read('app.vue');

describe('pwa update lifecycle', () => {
  test('registers in prompt mode, so a build is offered not applied', () => {
    expect(nuxtConfig).toContain("registerType: 'prompt'");
  });

  test('the prompt is mounted app-wide, not per layout', () => {
    expect(appVue).toContain('<UpdatePrompt');
  });

  test("skips waiting only on the page's SKIP_WAITING message", () => {
    const calls = sw
      .split('\n')
      .filter((line) => line.includes('self.skipWaiting()'));

    expect(sw).toContain("addEventListener('message'");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("'SKIP_WAITING'");
  });
});
