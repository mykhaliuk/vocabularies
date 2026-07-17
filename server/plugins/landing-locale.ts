// Entry-locale routing for the prerendered landing (ADR-0006): `/` is the
// English page; a GET lands on the static /fr | /uk variant when the visitor
// asked for it — an explicit vocabu-locale cookie first (the same "explicit
// choice persists" contract as ADR-0004), Accept-Language on first visit
// otherwise. Hooked on `request` (not server middleware) because Nitro's
// public-assets handler is registered ahead of middleware and would serve the
// prerendered index.html first; the request hook runs before any handler.
// Covers the Node server (preview, self-host); on Vercel the CDN serves
// prerendered HTML before any Nitro code, so the same roster is mirrored as
// edge routes generated in shared/landing-locales.ts (the edge leg is a
// first-tag approximation of this q-ordering — ADR-0006). Prerender itself
// sends no Accept-Language and no cookie, so build-time rendering of `/`
// passes straight through.
import {
  LANDING_ALT_LOCALES,
  LANDING_LOCALES,
  LOCALE_COOKIE,
} from '~/shared/landing-locales';
import { noStoreRedirect } from '~/server/utils/redirect';

const KNOWN_LOCALES: readonly string[] = LANDING_LOCALES;
const ALT_LOCALES = new Set<string>(LANDING_ALT_LOCALES);

// Minimal Accept-Language negotiation over the locales the landing ships:
// highest-q primary subtag among the roster wins; anything else is ignored so
// an unsupported browser locale falls through to English.
const pickLandingLocale = (header: string): string | undefined => {
  const ranges = header.split(',');
  let best: string | undefined;
  let bestQuality = 0;
  for (const range of ranges) {
    const parts = range.trim().split(';');
    const tag = parts[0]?.trim().toLowerCase() ?? '';
    if (tag === '') continue;
    const primary = tag.split('-')[0] ?? tag;
    if (!KNOWN_LOCALES.includes(primary)) continue;
    let quality = 1;
    for (let i = 1; i < parts.length; i++) {
      const param = parts[i]?.trim() ?? '';
      if (param.startsWith('q=')) quality = Number(param.slice(2));
    }
    if (!Number.isFinite(quality)) quality = 0;
    if (quality > bestQuality) {
      bestQuality = quality;
      best = primary;
    }
  }
  return best;
};

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    // event.path includes the query string; the redirect must fire for
    // `/?utm_source=…` too (matching the Vercel leg, which matches on the
    // pathname), so compare the pathname only.
    const pathname = event.path.split('?')[0];
    if (pathname !== '/') return;
    if (event.method !== 'GET' && event.method !== 'HEAD') return;
    const chosen = getCookie(event, LOCALE_COOKIE);
    if (chosen !== undefined) {
      if (ALT_LOCALES.has(chosen)) {
        // noStoreRedirect: the target varies per Cookie/Accept-Language, so
        // the 302 must never be stored by a shared cache.
        await noStoreRedirect(event, `/${chosen}`);
      }
      return;
    }
    const header = getHeader(event, 'accept-language');
    if (!header) return;
    const locale = pickLandingLocale(header);
    if (locale !== undefined && ALT_LOCALES.has(locale)) {
      await noStoreRedirect(event, `/${locale}`);
    }
  });
});
