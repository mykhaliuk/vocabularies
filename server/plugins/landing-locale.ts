// Entry-locale routing for the prerendered landing (ADR-0006): `/` is the
// English page; a GET lands on the static /fr | /uk variant when the visitor
// asked for it — an explicit vocabu-locale cookie first (the same "explicit
// choice persists" contract as ADR-0004), Accept-Language on first visit
// otherwise. Hooked on `request` (not server middleware) because Nitro's
// public-assets handler is registered ahead of middleware and would serve the
// prerendered index.html first; the request hook runs before any handler.
// Covers the Node server (preview, self-host); on Vercel the CDN serves
// prerendered HTML before any Nitro code, so the same rules are mirrored as
// edge routes in nuxt.config (nitro.vercel.config.routes). Prerender itself
// sends no Accept-Language and no cookie, so build-time rendering of `/`
// passes straight through.

const LANDING_LOCALES = new Set(['fr', 'uk']);

// Minimal Accept-Language negotiation over the locales the landing ships:
// highest-q primary subtag among en/fr/uk wins; anything else is ignored so
// an unsupported browser locale falls through to English.
const pickLandingLocale = (header: string): string | null => {
  const ranges = header.split(',');
  let best: string | null = null;
  let bestQuality = 0;
  for (const range of ranges) {
    const parts = range.trim().split(';');
    const tag = parts[0]?.trim().toLowerCase() ?? '';
    if (tag === '') continue;
    const primary = tag.split('-')[0] ?? tag;
    if (primary !== 'en' && !LANDING_LOCALES.has(primary)) continue;
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
    if (event.path !== '/') return;
    if (event.method !== 'GET' && event.method !== 'HEAD') return;
    const chosen = getCookie(event, 'vocabu-locale');
    if (chosen !== undefined) {
      if (LANDING_LOCALES.has(chosen)) {
        await sendRedirect(event, `/${chosen}`, 302);
      }
      return;
    }
    const header = getHeader(event, 'accept-language');
    if (!header) return;
    const locale = pickLandingLocale(header);
    if (locale !== null && LANDING_LOCALES.has(locale)) {
      await sendRedirect(event, `/${locale}`, 302);
    }
  });
});
