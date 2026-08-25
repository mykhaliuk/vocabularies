import { randomUUID } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { expect, test as base } from '@playwright/test';
import { watchPublicInternet } from '../hermetic';
import { SERVER_LOG_PATH } from './server-log';
import type { Locator, Page } from '@playwright/test';

// Sign-in harness for the authed e2e suite (VKB-101). Every screen behind
// `middleware: 'auth'` needs a real session, and this mints one the way a user
// does: request a magic link, read it from the server's console-email output
// (mirrored to a file by scripts/e2e-server.js), open it. The callback sets
// `vocabu_session` on the browser context, so the whole context — page
// navigations and `page.request` calls alike — is authenticated afterwards.

const LINK_TIMEOUT_MS = 20_000;
const LINK_POLL_MS = 100;
const SIGN_IN_TIMEOUT_MS = 30_000;
const HYDRATION_TIMEOUT_MS = 15_000;

// A fresh address per sign-in: a new user has an empty feed, so specs get
// isolation from each other without any cleanup step, and the log scan below
// can key on the address to find its own link.
export const uniqueEmail = (prefix = 'authed') =>
  `${prefix}-${randomUUID()}@example.com`;

// The server writes the log on start; before that there is nothing to match.
// Any other failure is a real fault — let it out.
const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === 'ENOENT';

export const serverLogSize = async () => {
  try {
    const { size } = await stat(SERVER_LOG_PATH);
    return size;
  } catch (error) {
    if (isMissing(error)) return 0;
    throw error;
  }
};

// Read only what was appended past `offset`, rather than the whole file each
// poll. Bounding the scan is what makes signing the SAME address twice in one
// run safe: the earlier line is behind the offset, so the backwards scan can
// no longer match a link the callback already consumed.
const readServerLogFrom = async (offset: number) => {
  let handle;
  try {
    handle = await open(SERVER_LOG_PATH, 'r');
  } catch (error) {
    if (isMissing(error)) return '';
    throw error;
  }
  try {
    const { size } = await handle.stat();
    if (size <= offset) return '';
    const buffer = Buffer.alloc(size - offset);
    await handle.read(buffer, 0, buffer.length, offset);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
};

// Matches the console emailer's line: `... magic-link to=<email> ... link=  <url>`
export const findMagicLink = async (email: string, offset: number) => {
  const marker = `to=${email}`;
  const deadline = Date.now() + LINK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const lines = (await readServerLogFrom(offset)).split('\n');
    // Skip the trailing element: it is whatever sits after the last newline,
    // i.e. a half-written line if the read caught the server mid-write. A torn
    // link would still match \S+ and send the test to a truncated URL.
    for (let i = lines.length - 2; i >= 0; i--) {
      const line = lines[i];
      if (line === undefined || !line.includes(marker)) continue;
      const match = /link=\s+(\S+)/.exec(line);
      if (match?.[1]) return match[1];
    }
    await sleep(LINK_POLL_MS);
  }
  throw new Error(
    `[authed] no magic link for ${email} in ${SERVER_LOG_PATH} after ` +
      `${LINK_TIMEOUT_MS}ms — the server is not using the console emailer. ` +
      'It needs APP_ENV=local AND no RESEND_API_KEY/EMAIL_FROM pair, which ' +
      'selects Resend at any stage (server/utils/email.ts).',
  );
};

// Sign the page's browser context in and leave it on /feed, where the magic
// link lands. Returns the address so a spec can assert on it (e.g. /me).
export const signIn = async (page: Page, email = uniqueEmail()) => {
  // Captured BEFORE the request, so the scan below can only see lines this
  // sign-in produced.
  const offset = await serverLogSize();

  const sent = await page.request.post('/api/auth/magic-link', {
    data: { email },
  });
  if (!sent.ok()) {
    throw new Error(
      `[authed] magic-link request failed for ${email}: ${sent.status()}`,
    );
  }

  const link = await findMagicLink(email, offset);
  const landed = await page.goto(link);
  if (!landed || !landed.ok()) {
    throw new Error(
      `[authed] the magic-link callback failed for ${email}: ` +
        `${landed ? landed.status() : 'no response'}`,
    );
  }

  try {
    await page.waitForURL('**/feed', { timeout: SIGN_IN_TIMEOUT_MS });
  } catch {
    // The callback answers a bad token with a redirect, not an error status,
    // so without this the only symptom is an opaque navigation timeout.
    const landing = new URL(page.url());
    const reason = landing.searchParams.get('error');
    throw new Error(
      `[authed] sign-in for ${email} never reached /feed — landed on ` +
        `${landing.pathname}${reason ? ` (error=${reason})` : ''}.`,
    );
  }
  return email;
};

// Re-issue a click until its own effect shows up. Vue hydrates on top of
// server-rendered markup, so a button exists — visible, enabled, clickable by
// every Playwright actionability check — before its @click listener is
// attached, and an early click is dispatched into nothing. Waiting on `load`
// does not help: it means the scripts arrived, not that they ran. Use this for
// any control whose effect is JS-driven; plain links need no such care.
//
// Two conditions on the control, because the retry is not free: it must be
// safe to click twice (never a submit), and its effect must not cover it — an
// overlay landing on top turns every later retry into an actionability
// timeout that reads nothing like "hydration never happened".
export const clickUntil = async (
  control: Locator,
  effect: () => Promise<void>,
) => {
  await expect(async () => {
    await control.click();
    await effect();
  }).toPass({ timeout: HYDRATION_TIMEOUT_MS });
};

// The FAB is addressed by class, not by its accessible name: that name is
// translated, and the specs that switch locale would stop finding it.
export const openCompose = async (page: Page) => {
  const sheet = page.locator('.compose--open');
  await clickUntil(page.locator('.bottom-nav__fab'), () =>
    expect(sheet).toBeVisible({ timeout: 1000 }),
  );
  return sheet;
};

// Vue hydrates on top of server-rendered markup, so a card exists — visible,
// clickable by every actionability check — before its @click listener is
// attached. Any spec whose assertions depend on client-side behaviour (a
// click that must NOT navigate, a client-side route change) has to establish
// hydration first, or it passes for the wrong reason. Opening and closing
// the compose sheet is the repo's usual probe: its effect is visible and it
// is safe to re-click.
export const settleHydration = async (page: Page) => {
  const sheet = await openCompose(page);
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await expect(sheet).toBeHidden();
};

interface AuthedFixtures {
  authedPage: Page;
}

// `authedPage` is a page in Playwright's usual per-test context, already
// signed in as a brand-new user and sitting on /feed. The context refuses
// the public internet and the test fails naming any URL that tried
// (VKB-123, e2e/hermetic.ts).
export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ page }, use) => {
    const assertHermetic = watchPublicInternet(page.context());
    await signIn(page);
    await use(page);
    assertHermetic();
  },
});

export { expect };
