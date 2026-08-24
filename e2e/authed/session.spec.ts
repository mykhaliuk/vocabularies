import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// A well-formed JWT whose sid points at no session row — reaches the db
// lookup and no further.
const forgeSessionJwt = async () => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ sid: randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(secret);
};

const sessionCookieOf = async (page: Page) => {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === 'vocabu_session');
  expect(session?.value).toBeTruthy();
  return `vocabu_session=${session?.value}`;
};

test('the 401 ladder names each rung', async ({ request }) => {
  const bare = await request.get('/api/me');
  expect(bare.status()).toBe(401);
  expect((await bare.json()).statusMessage).toBe('unauthenticated');

  const garbage = await request.get('/api/me', {
    headers: { cookie: 'vocabu_session=garbage' },
  });
  expect(garbage.status()).toBe(401);
  expect((await garbage.json()).statusMessage).toBe('invalid session token');

  const forged = await request.get('/api/me', {
    headers: { cookie: `vocabu_session=${await forgeSessionJwt()}` },
  });
  expect(forged.status()).toBe(401);
  expect((await forged.json()).statusMessage).toBe('session not found');
});

test('signing out ends the session, not just the cookie', async ({
  authedPage,
  request,
}) => {
  const savedCookie = await sessionCookieOf(authedPage);

  const before = await authedPage.request.get('/api/me');
  expect(before.status()).toBe(200);

  const out = await authedPage.request.post('/api/auth/logout');
  expect(out.status()).toBe(200);
  expect(await out.json()).toEqual({ ok: true });
  expect(out.headers()['cache-control']).toBe('no-store');

  // The saved cookie, replayed from a fresh jar: the session row itself must
  // be gone, not merely the browser's copy of the cookie.
  const replay = await request.get('/api/me', {
    headers: { cookie: savedCookie },
  });
  expect(replay.status()).toBe(401);
  expect((await replay.json()).statusMessage).toBe('session not found');
});

test('signing out without a session still answers ok', async ({ request }) => {
  const out = await request.post('/api/auth/logout');
  expect(out.status()).toBe(200);
  expect(await out.json()).toEqual({ ok: true });
});
