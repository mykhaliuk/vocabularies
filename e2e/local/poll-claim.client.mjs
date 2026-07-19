import { chromium } from '@playwright/test';

// Local-only integration test for the poll/claim + confirmation-code client
// (VKB-70): the full cross-jar scenario the ticket describes. NOT part of the
// CI e2e suite (needs a DB + console email) — see e2e/local/README. Invoked by
// e2e/local/run.mjs with { base, findLink }.

// Force the "installed standalone PWA" signal so the client mints a poll key.
const STANDALONE_INIT = `
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (q) =>
    q.includes('display-mode: standalone')
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } }
      : realMatchMedia(q);
`;

// Open the emailed link in a separate jar (Safari) and read the code it reveals.
const clickAndReadCode = async (browser, link) => {
  const safari = await browser.newContext();
  const page = await safari.newPage();
  await page.goto(link);
  await page.waitForLoadState('networkidle');
  const path = new URL(page.url()).pathname;
  const code = (await page.getByRole('status').innerText()).trim();
  return { safari, path, code };
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
    console.log('\n== Happy path: send -> click reveals code -> confirm ==');
    const email = `client-${Date.now()}@example.com`;
    const pwa = await browser.newContext();
    await pwa.addInitScript(STANDALONE_INIT);
    const pwaPage = await pwa.newPage();

    let sentPollKey = null;
    pwaPage.on('request', (req) => {
      if (
        req.url().endsWith('/api/auth/magic-link') &&
        req.method() === 'POST'
      ) {
        sentPollKey = req.postDataJSON()?.pollKey ?? null;
      }
    });

    await pwaPage.goto(`${base}/login`);
    await pwaPage.waitForLoadState('networkidle');
    await pwaPage.getByLabel(/your email/i).click();
    await pwaPage
      .getByLabel(/your email/i)
      .pressSequentially(email, { delay: 10 });
    await pwaPage.getByRole('button', { name: /send me a link/i }).click();
    await pwaPage.getByText(/check your inbox/i).waitFor({ timeout: 10000 });
    check(
      'standalone PWA sends a poll key with the magic-link request',
      typeof sentPollKey === 'string' &&
        /^[A-Za-z0-9_-]{43,64}$/.test(sentPollKey),
    );

    const link = await findLink(email);
    const clicked = await clickAndReadCode(browser, link);
    check(
      'Safari-jar click -> code page (not /me) showing a 4-digit code',
      clicked.path !== '/me' && /^\d{4}$/.test(clicked.code),
      `code=${clicked.code}`,
    );

    // The PWA poll flips to "confirm" -> the code input appears.
    const codeInput = pwaPage.getByLabel(/confirmation code/i);
    await codeInput.waitFor({ timeout: 20000 });
    check('PWA reveals the code input after the click', true);

    await codeInput.click();
    await codeInput.pressSequentially(clicked.code, { delay: 10 });
    await pwaPage.getByRole('button', { name: /^confirm$/i }).click();
    try {
      await pwaPage.waitForURL('**/me', { timeout: 20000 });
    } catch {
      // assertion below reports the actual URL
    }
    check(
      'entering the code signs the PWA in and navigates to /me',
      new URL(pwaPage.url()).pathname === '/me',
      pwaPage.url(),
    );

    const cookies = await pwa.cookies();
    const pwaSession = cookies.find((c) => c.name === 'vocabu_session');
    const safariCookies = await clicked.safari.cookies();
    const safariSession = safariCookies.find(
      (c) => c.name === 'vocabu_session',
    );
    check(
      'PWA jar received its own session cookie',
      Boolean(pwaSession?.value),
    );
    check(
      'PWA session cookie differs from the Safari jar cookie',
      Boolean(pwaSession?.value) &&
        Boolean(safariSession?.value) &&
        pwaSession.value !== safariSession.value,
    );
    check(
      'PWA /me shows the signed-in account',
      (await pwaPage.getByRole('heading', { level: 1 }).innerText()).includes(
        email,
      ),
    );
    check(
      'poll key cleared from localStorage after sign-in',
      (await pwaPage.evaluate(() => localStorage.getItem('vocabu_poll'))) ===
        null,
    );
    await clicked.safari.close();

    console.log('\n== Wrong code shows an inline error and allows retry ==');
    const email2 = `retry-${Date.now()}@example.com`;
    const pwa2 = await browser.newContext();
    await pwa2.addInitScript(STANDALONE_INIT);
    const p2 = await pwa2.newPage();
    await p2.goto(`${base}/login`);
    await p2.waitForLoadState('networkidle');
    await p2.getByLabel(/your email/i).click();
    await p2.getByLabel(/your email/i).pressSequentially(email2, { delay: 10 });
    await p2.getByRole('button', { name: /send me a link/i }).click();
    await p2.getByText(/check your inbox/i).waitFor({ timeout: 10000 });
    const link2 = await findLink(email2);
    const clicked2 = await clickAndReadCode(browser, link2);
    const wrong = String((Number(clicked2.code) + 1) % 10000).padStart(4, '0');
    const codeInput2 = p2.getByLabel(/confirmation code/i);
    await codeInput2.waitFor({ timeout: 20000 });
    await codeInput2.click();
    await codeInput2.pressSequentially(wrong, { delay: 10 });
    await p2.getByRole('button', { name: /^confirm$/i }).click();
    await p2.getByRole('alert').waitFor({ timeout: 10000 });
    check(
      'wrong code -> stays on the code screen with an error, no /me',
      new URL(p2.url()).pathname !== '/me' &&
        (await p2.getByLabel(/confirmation code/i).count()) === 1,
    );
    // Then the correct code still works.
    await codeInput2.fill('');
    await codeInput2.pressSequentially(clicked2.code, { delay: 10 });
    await p2.getByRole('button', { name: /^confirm$/i }).click();
    try {
      await p2.waitForURL('**/me', { timeout: 20000 });
    } catch {
      // reported below
    }
    check(
      'correct code after a wrong attempt signs in',
      new URL(p2.url()).pathname === '/me',
      p2.url(),
    );
    await clicked2.safari.close();

    console.log('\n== Cold-start resume into the confirm step ==');
    const email3 = `resume-${Date.now()}@example.com`;
    const resume = await browser.newContext();
    await resume.addInitScript(STANDALONE_INIT);
    const r1 = await resume.newPage();
    await r1.goto(`${base}/login`);
    await r1.waitForLoadState('networkidle');
    await r1.getByLabel(/your email/i).click();
    await r1.getByLabel(/your email/i).pressSequentially(email3, { delay: 10 });
    await r1.getByRole('button', { name: /send me a link/i }).click();
    await r1.getByText(/check your inbox/i).waitFor({ timeout: 10000 });
    await r1.close(); // simulate iOS eviction (key stays in the jar)
    const link3 = await findLink(email3);
    const clicked3 = await clickAndReadCode(browser, link3);
    // Relaunch the PWA: resume() re-attaches, poll returns confirm, code input.
    const r2 = await resume.newPage();
    await r2.goto(`${base}/login`);
    const codeInput3 = r2.getByLabel(/confirmation code/i);
    await codeInput3.waitFor({ timeout: 20000 });
    await codeInput3.click();
    await codeInput3.pressSequentially(clicked3.code, { delay: 10 });
    await r2.getByRole('button', { name: /^confirm$/i }).click();
    try {
      await r2.waitForURL('**/me', { timeout: 20000 });
    } catch {
      // reported below
    }
    check(
      'cold-start resume re-attaches, then the code signs the PWA in',
      new URL(r2.url()).pathname === '/me',
      r2.url(),
    );
    await clicked3.safari.close();
  } finally {
    await browser.close();
  }

  console.log(`\n  client: ${passed} passed, ${failed} failed`);
  return { passed, failed };
};
