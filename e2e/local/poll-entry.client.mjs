import { chromium } from '@playwright/test';
import { STANDALONE_INIT, clickAndReadCode } from './helpers.mjs';

// Local-only UI tests for the VKB-70 QA fixes: an installed standalone PWA
// resolves its entry (the app when signed in, /login otherwise) instead of
// landing on the codeless marketing hero, and /login shows the confirmation-code
// field immediately on send. The confirm-failure cases pin the invariant that
// replaced the old arming inference: a failed confirm NEVER tears the pending
// sign-in down — the message is honest about both possible states, the key and
// the poll survive so a link opened afterwards still completes the sign-in, and
// "ask for a new link" is always one tap away. NOT part of the CI e2e suite
// (needs a DB + console email) — see e2e/local/README. Invoked by
// e2e/local/run.mjs with { base, findLink }.

// English locale so the assertions match the en copy regardless of the host's
// Accept-Language, and so the entry-locale redirect never bounces `/` to /fr.
const EN = { locale: 'en-US' };

const pathOf = (page) => new URL(page.url()).pathname;

const gotoExpecting = async (context, url, pattern) => {
  const page = await context.newPage();
  await page.goto(url);
  try {
    await page.waitForURL(pattern, { timeout: 15000 });
  } catch {
    // assertion reports the actual URL
  }
  return page;
};

const sendFrom = async (page, base, email) => {
  await page.goto(`${base}/login`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/your email/i).click();
  await page.getByLabel(/your email/i).pressSequentially(email, { delay: 10 });
  await page.getByRole('button', { name: /send me a link/i }).click();
};

export const run = async ({ base, findLink }) => {
  let passed = 0;
  let failed = 0;
  const check = (name, cond, extra = '') => {
    if (cond) passed++;
    else failed++;
    console.log(
      `  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`,
    );
  };

  const browser = await chromium.launch();
  try {
    console.log('\n== FIX 1: signed-out standalone is routed to /login ==');
    const standalone = await browser.newContext(EN);
    await standalone.addInitScript(STANDALONE_INIT);

    const fromRoot = await gotoExpecting(standalone, `${base}/`, '**/login');
    check(
      'signed-out standalone `/` redirects to /login',
      pathOf(fromRoot) === '/login',
      fromRoot.url(),
    );

    const fromFr = await gotoExpecting(standalone, `${base}/fr`, '**/login');
    check(
      'signed-out standalone `/fr` redirects to /login (locale unaffected)',
      pathOf(fromFr) === '/login',
      fromFr.url(),
    );

    console.log('\n== FIX 1: the entry probe is bounded on any engine ==');
    // Black-hole /api/me AND remove AbortSignal.timeout (iOS <= 15), so the only
    // thing that can end the probe is ofetch's own timer. The launch must still
    // resolve — a dead probe degrades to the sign-in screen, it never strands
    // the PWA on the landing — and must cost ONE timeout, not two (ofetch
    // retries a GET by default and does not treat a TimeoutError as an abort,
    // so `retry: false` is what holds this bound).
    const slowCtx = await browser.newContext(EN);
    await slowCtx.addInitScript(STANDALONE_INIT);
    await slowCtx.addInitScript(`
      try { delete AbortSignal.timeout; } catch {}
    `);
    await slowCtx.route('**/api/me', () => {
      // never fulfilled: the probe hangs until it is timed out client-side
    });
    const slowPage = await slowCtx.newPage();
    await slowPage.goto(`${base}/`);
    const probeStartedAt = Date.now();
    try {
      await slowPage.waitForURL('**/login', { timeout: 20000 });
    } catch {
      // assertion reports the actual URL
    }
    const probeElapsedMs = Date.now() - probeStartedAt;
    check(
      'a black-holed probe still resolves the entry (no AbortSignal.timeout)',
      pathOf(slowPage) === '/login',
      `${probeElapsedMs}ms -> ${slowPage.url()}`,
    );
    check(
      'the entry costs one probe timeout, not two',
      pathOf(slowPage) === '/login' && probeElapsedMs < 5000,
      `${probeElapsedMs}ms`,
    );
    await slowCtx.close();

    console.log('\n== FIX 2: /login shows the code field immediately ==');
    const email = `entry-${Date.now()}@example.com`;
    const p = await standalone.newPage();
    await sendFrom(p, base, email);

    // The code input must appear on send — before any link is clicked / armed.
    const codeInput = p.getByLabel(/confirmation code/i);
    await codeInput.waitFor({ timeout: 10000 });
    check('code field is visible immediately after send (pre-arming)', true);
    check(
      'standalone "sent" screen does not show the plain check-inbox message',
      (await p.getByText(/check your inbox/i).count()) === 0,
    );

    console.log('\n== FIX 2: a failed confirm guides, and never strands ==');
    // Type a code and confirm BEFORE the link is clicked. The claim is unarmed,
    // so the server answers `expired`. The client must NOT guess why: it shows
    // the one honest message, keeps the field and the resend action, and — the
    // regression that matters — keeps the poll key, because the magic link is
    // still valid for ~15 minutes and must still be able to finish the sign-in.
    await codeInput.click();
    await codeInput.pressSequentially('0000', { delay: 10 });
    await p.getByRole('button', { name: /^confirm$/i }).click();
    await p.getByText(/that code didn't work/i).waitFor({ timeout: 10000 });
    check(
      'failed confirm guides to open the link and enter the code it shows',
      (await p.getByText(/that code didn't work/i).count()) === 1,
    );
    check(
      'failed confirm does NOT bounce to the email form',
      (await p.getByRole('button', { name: /send me a link/i }).count()) ===
        0 && (await codeInput.count()) === 1,
    );
    check('failed confirm does NOT navigate to /me', pathOf(p) !== '/me');
    check(
      'failed confirm keeps "ask for a new link" reachable',
      (await p.getByRole('button', { name: /^resend$/i }).count()) === 1,
    );
    // The mutation target: re-introducing clear() on a failed confirm wipes
    // this key, and the sign-in below can then never complete.
    check(
      'failed confirm does NOT discard the poll key',
      (await p.evaluate(() => localStorage.getItem('vocabu_poll'))) !== null,
    );

    // Prove the pending sign-in survived a failed confirm: click the real link,
    // and the real code still signs the PWA in.
    const link = await findLink(email);
    const clicked = await clickAndReadCode(browser, link);
    check(
      'the emailed link still arms a fresh code page',
      clicked.path !== '/me' && /^\d{4}$/.test(clicked.code),
      `code=${clicked.code}`,
    );
    await codeInput.click();
    await codeInput.fill('');
    await codeInput.pressSequentially(clicked.code, { delay: 10 });
    await p.getByRole('button', { name: /^confirm$/i }).click();
    try {
      await p.waitForURL('**/me', { timeout: 20000 });
    } catch {
      // reported below
    }
    check(
      'the real code still signs the PWA in after a failed confirm',
      pathOf(p) === '/me',
      p.url(),
    );
    await clicked.safari.close();

    // The standalone context now holds a session — the returning-user case.
    console.log('\n== FIX A: a signed-in launch resolves to the app ==');
    const relaunch = await gotoExpecting(standalone, `${base}/`, '**/me');
    check(
      'signed-in standalone `/` resolves to /me, not the sign-in form',
      pathOf(relaunch) === '/me',
      relaunch.url(),
    );
    check(
      'signed-in standalone launch never shows the email form',
      (await relaunch
        .getByRole('button', { name: /send me a link/i })
        .count()) === 0,
    );

    const guarded = await gotoExpecting(standalone, `${base}/login`, '**/me');
    check(
      'authenticated visitor reaching /login is sent to /me',
      pathOf(guarded) === '/me',
      guarded.url(),
    );

    console.log(
      '\n== FIX B: a locked claim still never tears the screen down ==',
    );
    // A genuinely dead claim: arm it, then burn the 3-attempt cap. The client
    // must NOT infer anything from that — it shows the one honest message,
    // leaves the code screen standing, keeps the key, and keeps "ask for a new
    // link" one tap away.
    const deadEmail = `dead-${Date.now()}@example.com`;
    const deadCtx = await browser.newContext(EN);
    await deadCtx.addInitScript(STANDALONE_INIT);
    const dp = await deadCtx.newPage();
    await sendFrom(dp, base, deadEmail);
    const deadInput = dp.getByLabel(/confirmation code/i);
    await deadInput.waitFor({ timeout: 10000 });

    const deadLink = await findLink(deadEmail);
    const deadClicked = await clickAndReadCode(browser, deadLink);
    const deadWrong = String((Number(deadClicked.code) + 1) % 10000).padStart(
      4,
      '0',
    );
    for (let attempt = 1; attempt <= 3; attempt++) {
      await deadInput.fill('');
      await deadInput.pressSequentially(deadWrong, { delay: 5 });
      await dp.getByRole('button', { name: /^confirm$/i }).click();
      if (attempt < 3) {
        await dp
          .getByText(/that code isn't right/i)
          .waitFor({ timeout: 10000 });
      }
    }
    await dp.getByText(/that code didn't work/i).waitFor({ timeout: 10000 });

    check(
      'locked claim keeps the code screen (no bounce to the send form)',
      (await dp.getByLabel(/confirmation code/i).count()) === 1 &&
        (await dp.getByRole('button', { name: /send me a link/i }).count()) ===
          0,
    );
    check(
      'locked claim shows the one honest guidance message',
      (await dp.getByText(/that code didn't work/i).count()) === 1,
    );
    check(
      'locked claim keeps "ask for a new link" reachable',
      (await dp.getByRole('button', { name: /^resend$/i }).count()) === 1,
    );
    check(
      'locked claim does NOT discard the poll key',
      (await dp.evaluate(() => localStorage.getItem('vocabu_poll'))) !== null,
    );
    await deadClicked.safari.close();
    await deadCtx.close();

    console.log(
      '\n== Non-standalone is untouched (no code field, no redirect) ==',
    );
    const web = await browser.newContext(EN);

    // Landing stays put for a plain browser visitor.
    const landing = await web.newPage();
    await landing.goto(`${base}/`);
    await landing.waitForLoadState('networkidle');
    check(
      'non-standalone `/` stays on the landing (no /login redirect)',
      pathOf(landing) !== '/login',
      landing.url(),
    );
    check(
      'landing shows no confirmation-code field',
      (await landing.getByLabel(/confirmation code/i).count()) === 0,
    );

    // /login in a plain browser: send -> "check your inbox", no code field.
    const webEmail = `web-${Date.now()}@example.com`;
    const wp = await web.newPage();
    await sendFrom(wp, base, webEmail);
    await wp.getByText(/check your inbox/i).waitFor({ timeout: 10000 });
    check(
      'non-standalone /login shows the plain check-inbox message',
      (await wp.getByText(/check your inbox/i).count()) === 1,
    );
    check(
      'non-standalone /login shows no code field',
      (await wp.getByLabel(/confirmation code/i).count()) === 0,
    );
  } finally {
    await browser.close();
  }

  console.log(`\n  entry: ${passed} passed, ${failed} failed`);
  return { passed, failed };
};
