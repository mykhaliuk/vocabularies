import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { findMagicLink, serverLogSize, uniqueEmail } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

const newPollKey = () => randomBytes(32).toString('base64url');

const readConfirmCode = async (page: Page) => {
  const status = page.locator('[role="status"]');
  await expect(status).toHaveText(/^\s*\d{4}\s*$/);
  const text = await status.innerText();
  return text.trim();
};

const wrongCodeFor = (code: string) =>
  String((Number(code) + 1) % 10000).padStart(4, '0');

// The PWA jar is the `request` fixture (its own cookie store); the clicker
// jar is the page's browser context. Keeping them apart is the point of the
// flow under test.
const startDeviceFlow = async (page: Page, request: APIRequestContext) => {
  const email = uniqueEmail('device');
  const pollKey = newPollKey();
  const offset = await serverLogSize();

  const sent = await request.post('/api/auth/magic-link', {
    data: { email, pollKey },
  });
  expect(sent.status()).toBe(200);

  const link = await findMagicLink(email, offset);
  return { email, pollKey, link };
};

test('requesting a link acknowledges without caching', async ({ request }) => {
  const response = await request.post('/api/auth/magic-link', {
    data: { email: uniqueEmail('pin') },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ ok: true });
});

test('malformed bodies are rejected before any work', async ({ request }) => {
  const badEmail = await request.post('/api/auth/magic-link', {
    data: { email: 'not-an-email' },
  });
  expect(badEmail.status()).toBe(400);

  const badPoll = await request.post('/api/auth/poll', {
    data: { pollKey: 'too-short' },
  });
  expect(badPoll.status()).toBe(400);

  const badConfirm = await request.post('/api/auth/confirm', {
    data: { pollKey: newPollKey(), code: '12345' },
  });
  expect(badConfirm.status()).toBe(400);
});

test('the callback without a valid token bounces to login', async ({
  request,
}) => {
  const bare = await request.get('/api/auth/callback', {
    maxRedirects: 0,
  });
  expect(bare.status()).toBe(302);
  expect(bare.headers()['location']).toBe('/login?error=token-invalid');
  expect(bare.headers()['cache-control']).toBe('no-store');

  const garbage = await request.get(
    `/api/auth/callback?token=${newPollKey()}`,
    { maxRedirects: 0 },
  );
  expect(garbage.status()).toBe(302);
  expect(garbage.headers()['location']).toBe('/login?error=token-invalid');
});

test('an unknown poll key reads as pending, an unknown confirm as expired', async ({
  request,
}) => {
  const poll = await request.post('/api/auth/poll', {
    data: { pollKey: newPollKey() },
  });
  expect(poll.status()).toBe(200);
  expect(poll.headers()['cache-control']).toBe('no-store');
  expect(await poll.json()).toEqual({ status: 'pending' });

  const confirm = await request.post('/api/auth/confirm', {
    data: { pollKey: newPollKey(), code: '0000' },
  });
  expect(confirm.status()).toBe(200);
  expect(confirm.headers()['cache-control']).toBe('no-store');
  expect(await confirm.json()).toEqual({ status: 'expired' });
});

test('the device flow issues a session only after the code round-trip', async ({
  page,
  request,
}) => {
  const { email, pollKey, link } = await startDeviceFlow(page, request);

  const before = await request.post('/api/auth/poll', { data: { pollKey } });
  expect(await before.json()).toEqual({ status: 'pending' });

  await page.goto(link);
  const code = await readConfirmCode(page);

  const armed = await request.post('/api/auth/poll', { data: { pollKey } });
  expect(await armed.json()).toEqual({ status: 'confirm' });

  const miss = await request.post('/api/auth/confirm', {
    data: { pollKey, code: wrongCodeFor(code) },
  });
  expect(await miss.json()).toEqual({ status: 'invalid' });

  const hit = await request.post('/api/auth/confirm', {
    data: { pollKey, code },
  });
  expect(hit.status()).toBe(200);
  const body = await hit.json();
  expect(body.status).toBe('ready');
  expect(body.user.email).toBe(email);
  expect(hit.headers()['set-cookie']).toContain('vocabu_session=');

  const claimed = await request.post('/api/auth/poll', { data: { pollKey } });
  expect(await claimed.json()).toEqual({ status: 'pending' });
});

// Password-manager autofill can set the field without an `input` event;
// the pin types nothing and expects Enter alone to carry the submit.
test('an autofilled email still submits on enter', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    const input = document.querySelector('#email') as HTMLInputElement;
    input.value = `autofill-${Date.now()}@example.com`;
  });
  const email = page.getByLabel(/your email/i);
  await email.click();
  await page.keyboard.press('Enter');

  await expect(page.locator('.auth__panel--sent')).toBeVisible();
});

test('three wrong codes lock the claim for good', async ({ page, request }) => {
  const { pollKey, link } = await startDeviceFlow(page, request);

  await page.goto(link);
  const code = await readConfirmCode(page);
  const wrong = wrongCodeFor(code);

  const first = await request.post('/api/auth/confirm', {
    data: { pollKey, code: wrong },
  });
  expect(await first.json()).toEqual({ status: 'invalid' });

  const second = await request.post('/api/auth/confirm', {
    data: { pollKey, code: wrong },
  });
  expect(await second.json()).toEqual({ status: 'invalid' });

  const third = await request.post('/api/auth/confirm', {
    data: { pollKey, code: wrong },
  });
  expect(await third.json()).toEqual({ status: 'expired' });

  const late = await request.post('/api/auth/confirm', {
    data: { pollKey, code },
  });
  expect(await late.json()).toEqual({ status: 'expired' });
});
