import { chromium } from '@playwright/test';

// Local-only integration test for the poll/claim client (VKB-70): the full
// cross-jar scenario the ticket describes. NOT part of the CI e2e suite (needs
// a DB + console email) — see e2e/local/README. Invoked by e2e/local/run.mjs
// with { base, findLink }.

// Force the "installed standalone PWA" signal so the client mints a poll key.
const STANDALONE_INIT = `
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (q) =>
    q.includes('display-mode: standalone')
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } }
      : realMatchMedia(q);
`;

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
    const emailInput = pwaPage.getByLabel(/your email/i);
    const submitBtn = pwaPage.getByRole('button', { name: /send me a link/i });
    await emailInput.click();
    await emailInput.pressSequentially(email, { delay: 10 });
    await submitBtn.click({ timeout: 15000 });
    await pwaPage.getByText(/check your inbox/i).waitFor({ timeout: 10000 });

    check(
      'standalone PWA sends a poll key with the magic-link request',
      typeof sentPollKey === 'string' &&
        /^[A-Za-z0-9_-]{43,64}$/.test(sentPollKey),
      sentPollKey ? `len=${sentPollKey.length}` : 'none',
    );
    const storedKey = await pwaPage.evaluate(() =>
      localStorage.getItem('vocabu_poll'),
    );
    check(
      'poll key persisted to the PWA jar localStorage',
      Boolean(storedKey) && storedKey.includes(sentPollKey),
    );

    const link = await findLink(email);
    const safari = await browser.newContext();
    const safariPage = await safari.newPage();
    await safariPage.goto(link);
    await safariPage.waitForLoadState('networkidle');
    check(
      'Safari-jar link click lands on /me (its own session)',
      new URL(safariPage.url()).pathname === '/me',
      safariPage.url(),
    );

    try {
      await pwaPage.waitForURL('**/me', { timeout: 20000 });
    } catch {
      // assertion below reports the actual URL
    }
    check(
      'PWA poll readied and auto-navigated to /me',
      new URL(pwaPage.url()).pathname === '/me',
      pwaPage.url(),
    );

    const cookies = await pwa.cookies();
    const pwaSession = cookies.find((c) => c.name === 'vocabu_session');
    const safariCookies = await safari.cookies();
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

    const greeting = await pwaPage
      .getByRole('heading', { level: 1 })
      .innerText();
    check(
      'PWA /me shows the signed-in account',
      greeting.includes(email),
      greeting,
    );

    const afterKey = await pwaPage.evaluate(() =>
      localStorage.getItem('vocabu_poll'),
    );
    check(
      'poll key cleared from localStorage after sign-in',
      afterKey === null,
    );

    // Cold-start resume: a fresh context that already holds a valid persisted
    // poll re-attaches on load and collects an armed claim without a resend.
    console.log('\n== Cold-start resume ==');
    const resumeEmail = `resume-${Date.now()}@example.com`;
    const resume = await browser.newContext();
    await resume.addInitScript(STANDALONE_INIT);
    const rp1 = await resume.newPage();
    await rp1.goto(`${base}/login`);
    await rp1.waitForLoadState('networkidle');
    await rp1.getByLabel(/your email/i).click();
    await rp1
      .getByLabel(/your email/i)
      .pressSequentially(resumeEmail, { delay: 10 });
    await rp1.getByRole('button', { name: /send me a link/i }).click();
    await rp1.getByText(/check your inbox/i).waitFor({ timeout: 10000 });
    // Simulate iOS eviction: close the page (key stays in the context jar).
    await rp1.close();
    // Arm the claim from a separate jar.
    const resumeLink = await findLink(resumeEmail);
    const rSafari = await resume.browser().newContext();
    const rsp = await rSafari.newPage();
    await rsp.goto(resumeLink);
    await rsp.waitForLoadState('networkidle');
    // Relaunch the PWA at /login: resume() should re-attach and sign in.
    const rp2 = await resume.newPage();
    await rp2.goto(`${base}/login`);
    try {
      await rp2.waitForURL('**/me', { timeout: 20000 });
    } catch {
      // assertion reports actual URL
    }
    check(
      'cold-start resume re-attaches and signs the PWA in',
      new URL(rp2.url()).pathname === '/me',
      rp2.url(),
    );
    await rSafari.close();
  } finally {
    await browser.close();
  }

  console.log(`\n  client: ${passed} passed, ${failed} failed`);
  return { passed, failed };
};
