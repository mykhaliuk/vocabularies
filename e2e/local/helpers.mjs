// Shared helpers for the local-only poll/claim + entry tests (VKB-70). These
// simulate the installed-PWA jar boundary with separate browser contexts; they
// prove the mechanism, not the on-device iOS jar (which needs a real iPhone).

// English locale so the assertions match the en copy regardless of the host's
// Accept-Language, and so the entry-locale redirect never bounces `/` to /fr.
export const EN = { locale: 'en-US' };

// Force the "installed standalone PWA" signal so the client mints a poll key
// and /login shows the code field up front. Injected before any page script
// runs (addInitScript) so isStandalone() reads true on first render.
export const STANDALONE_INIT = `
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (q) =>
    q.includes('display-mode: standalone')
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } }
      : realMatchMedia(q);
`;

// Request a magic link from /login. pressSequentially (not fill) so the
// v-model ref actually updates before hydration settles the submit button.
export const sendFrom = async (page, base, email) => {
  await page.goto(`${base}/login`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/your email/i).click();
  await page.getByLabel(/your email/i).pressSequentially(email, { delay: 10 });
  await page.getByRole('button', { name: /send me a link/i }).click();
};

// Open the emailed link in a separate jar (Safari) and read the code it reveals.
// Not EN: nothing below is read by name — a role and a URL path only.
export const clickAndReadCode = async (browser, link) => {
  const safari = await browser.newContext();
  const page = await safari.newPage();
  await page.goto(link);
  await page.waitForLoadState('networkidle');
  const path = new URL(page.url()).pathname;
  const code = (await page.getByRole('status').innerText()).trim();
  return { safari, path, code };
};
