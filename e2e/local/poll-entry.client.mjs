import { chromium } from '@playwright/test';
import { STANDALONE_INIT, clickAndReadCode } from './helpers.mjs';

// Local-only UI tests for the VKB-70 QA fix: an installed standalone PWA is
// routed off the codeless marketing landing to /login (FIX 1), and /login shows
// the confirmation-code field immediately on send instead of after the poll
// observes the click (FIX 2), including the graceful pre-armed premature-submit
// path. NOT part of the CI e2e suite (needs a DB + console email) — see
// e2e/local/README. Invoked by e2e/local/run.mjs with { base, findLink }.

// English locale so the assertions match the en copy regardless of the host's
// Accept-Language, and so the entry-locale redirect never bounces `/` to /fr.
const EN = { locale: 'en-US' };

const pathOf = (page) => new URL(page.url()).pathname;

const gotoRedirect = async (context, url) => {
  const page = await context.newPage();
  await page.goto(url);
  try {
    await page.waitForURL('**/login', { timeout: 10000 });
  } catch {
    // assertion reports the actual URL
  }
  return page;
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
    console.log('\n== FIX 1: standalone PWA is routed off the landing ==');
    const standalone = await browser.newContext(EN);
    await standalone.addInitScript(STANDALONE_INIT);

    const fromRoot = await gotoRedirect(standalone, `${base}/`);
    check(
      'standalone `/` redirects to /login',
      pathOf(fromRoot) === '/login',
      fromRoot.url(),
    );

    const fromFr = await gotoRedirect(standalone, `${base}/fr`);
    check(
      'standalone `/fr` redirects to /login (locale entry unaffected)',
      pathOf(fromFr) === '/login',
      fromFr.url(),
    );

    console.log('\n== FIX 2: /login shows the code field immediately ==');
    const email = `entry-${Date.now()}@example.com`;
    const p = await standalone.newPage();
    await p.goto(`${base}/login`);
    await p.waitForLoadState('networkidle');
    await p.getByLabel(/your email/i).click();
    await p.getByLabel(/your email/i).pressSequentially(email, { delay: 10 });
    await p.getByRole('button', { name: /send me a link/i }).click();

    // The code input must appear on send — before any link is clicked / armed.
    const codeInput = p.getByLabel(/confirmation code/i);
    await codeInput.waitFor({ timeout: 10000 });
    check('code field is visible immediately after send (pre-arming)', true);
    check(
      'standalone "sent" screen does not show the plain check-inbox message',
      (await p.getByText(/check your inbox/i).count()) === 0,
    );

    console.log('\n== FIX 2: premature submit is gentle, not stranding ==');
    // Type a code and confirm BEFORE the link is clicked. The claim is unarmed,
    // so the server returns expired -> the client shows "open the link first"
    // and keeps the field + poll alive (no attempt consumed, no bounce).
    await codeInput.click();
    await codeInput.pressSequentially('0000', { delay: 10 });
    await p.getByRole('button', { name: /^confirm$/i }).click();
    await p
      .getByText(/open the link in your email first/i)
      .waitFor({ timeout: 10000 });
    check(
      'premature submit -> gentle "open the link first" hint',
      (await p.getByText(/open the link in your email first/i).count()) === 1,
    );
    check(
      'premature submit does NOT bounce to the email form',
      (await p.getByRole('button', { name: /send me a link/i }).count()) ===
        0 && (await codeInput.count()) === 1,
    );
    check('premature submit does NOT navigate to /me', pathOf(p) !== '/me');

    // Prove the flow is not stranded: click the real link, then the real code
    // still signs the PWA in.
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
      'the real code after a premature attempt signs the PWA in',
      pathOf(p) === '/me',
      p.url(),
    );
    await clicked.safari.close();

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
    await wp.goto(`${base}/login`);
    await wp.waitForLoadState('networkidle');
    await wp.getByLabel(/your email/i).click();
    await wp.getByLabel(/your email/i).pressSequentially(webEmail, {
      delay: 10,
    });
    await wp.getByRole('button', { name: /send me a link/i }).click();
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
