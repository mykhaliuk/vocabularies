// Single source of truth for the landing locale roster (ADR-0006). Every
// consumer — the Vercel edge routes and prerender routeRules (nuxt.config.js),
// the Nitro redirect plugin, the landing component's path/og maps, and the
// LandingCopy type — derives from this module, so adding a locale is a
// type-checked change here plus a copy module and a page wrapper, not a hunt
// across six hand-synced declarations.

export const LANDING_LOCALES = ['en', 'fr', 'uk'] as const;

export type LandingLocale = (typeof LANDING_LOCALES)[number];

export const LANDING_DEFAULT_LOCALE: LandingLocale = 'en';

export const LANDING_ALT_LOCALES = LANDING_LOCALES.filter(
  (locale) => locale !== LANDING_DEFAULT_LOCALE,
);

export const isLandingLocale = (value: string): value is LandingLocale =>
  (LANDING_LOCALES as readonly string[]).includes(value);

// Minimal Accept-Language negotiation over the locales we ship: the highest-q
// primary subtag among the roster wins; anything unsupported is ignored so the
// caller can fall back (to English for the landing redirect, to the default
// for the email locale — VKB-55). Shared so the Nitro landing plugin and the
// server-side email locale resolver run one implementation, not two hand-synced
// copies. RE2 `has` conditions on the Vercel edge cannot parse q-values, so the
// edge leg (landingVercelRoutes) stays a first-tag approximation of this —
// ADR-0006.
export const pickAcceptLanguageLocale = (
  header: string,
): LandingLocale | undefined => {
  const ranges = header.split(',');
  let best: LandingLocale | undefined;
  let bestQuality = 0;
  for (const range of ranges) {
    const parts = range.trim().split(';');
    const tag = parts[0]?.trim().toLowerCase() ?? '';
    if (tag === '') continue;
    const primary = tag.split('-')[0] ?? tag;
    if (!isLandingLocale(primary)) continue;
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

// The same cookie @nuxtjs/i18n writes (detectBrowserLanguage.cookieKey) — the
// "explicit choice persists" contract of ADR-0004 that the landing honors.
export const LOCALE_COOKIE = 'vocabu-locale';

export const LANDING_LOCALE_PATHS: Record<LandingLocale, string> = {
  en: '/',
  fr: '/fr',
  uk: '/uk',
};

export const LANDING_OG_LOCALES: Record<LandingLocale, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  uk: 'uk_UA',
};

// Endonyms for the visible locale switcher (aria labels).
export const LANDING_LOCALE_NAMES: Record<LandingLocale, string> = {
  en: 'English',
  fr: 'Français',
  uk: 'Українська',
};

// Vercel edge routes for the entry-locale redirect on `/` (ADR-0006). `src`
// is anchored (`^/$`) — Vercel treats it as a regex, unanchored `/` would
// match every path. The header regexes are a first-tag approximation of the
// Nitro plugin's full q-ordering: RE2 `has` conditions cannot parse
// q-values, so `fr;q=0` (explicit refusal) and uppercase tags deviate from
// the Node leg — accepted and recorded in ADR-0006. Cookie routes come first
// so an explicit choice always wins.
export const landingVercelRoutes = () => [
  ...LANDING_ALT_LOCALES.map((locale) => ({
    src: '^/$',
    has: [{ type: 'cookie', key: LOCALE_COOKIE, value: locale }],
    status: 302,
    headers: { Location: LANDING_LOCALE_PATHS[locale] },
  })),
  ...LANDING_ALT_LOCALES.map((locale) => ({
    src: '^/$',
    missing: [{ type: 'cookie', key: LOCALE_COOKIE }],
    has: [
      {
        type: 'header',
        key: 'accept-language',
        value: `^${locale}$|^${locale}[-,;].*`,
      },
    ],
    status: 302,
    headers: { Location: LANDING_LOCALE_PATHS[locale] },
  })),
];

// routeRules entries prerendering one static page per locale.
export const landingPrerenderRules = () =>
  Object.fromEntries(
    LANDING_LOCALES.map((locale) => [
      LANDING_LOCALE_PATHS[locale],
      { prerender: true },
    ]),
  );
