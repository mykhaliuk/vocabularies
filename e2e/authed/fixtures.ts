import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { expect, test as base } from '@playwright/test';
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

const readServerLog = async () => {
  try {
    return await readFile(SERVER_LOG_PATH, 'utf8');
  } catch (error) {
    // The server writes the file on start; until then there is simply nothing
    // to match yet. Any other read failure is a real fault — let it out.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
};

// Matches the console emailer's line: `... magic-link to=<email> ... link=  <url>`
const findMagicLink = async (email: string) => {
  const marker = `to=${email}`;
  const deadline = Date.now() + LINK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const lines = (await readServerLog()).split('\n');
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
  const sent = await page.request.post('/api/auth/magic-link', {
    data: { email },
  });
  if (!sent.ok()) {
    throw new Error(
      `[authed] magic-link request failed for ${email}: ${sent.status()}`,
    );
  }

  const link = await findMagicLink(email);
  await page.goto(link);
  await page.waitForURL('**/feed', { timeout: SIGN_IN_TIMEOUT_MS });
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

interface AuthedFixtures {
  authedPage: Page;
}

// `authedPage` is a page in Playwright's usual per-test context, already
// signed in as a brand-new user and sitting on /feed.
export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ page }, use) => {
    await signIn(page);
    await use(page);
  },
});

export { expect };
