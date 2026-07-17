// Server-side locale resolution for request-scoped rendering that runs outside
// the vue-i18n runtime (which is client-only) — today the magic-link email
// (VKB-55). Mirrors the precedence fixed in ADR-0004: an explicit vocabu-locale
// cookie wins, Accept-Language decides on a first visit with no cookie, and the
// default locale is the floor. Reuses the roster, cookie key, and q-weighted
// negotiator from shared/landing-locales.ts so nothing is hand-synced.
import {
  LANDING_DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLandingLocale,
  pickAcceptLanguageLocale,
  type LandingLocale,
} from '~/shared/landing-locales';
import type { H3Event } from 'h3';

export const resolveRequestLocale = (event: H3Event): LandingLocale => {
  const cookie = getCookie(event, LOCALE_COOKIE);
  if (cookie !== undefined && isLandingLocale(cookie)) return cookie;

  const header = getHeader(event, 'accept-language');
  if (header) {
    const negotiated = pickAcceptLanguageLocale(header);
    if (negotiated !== undefined) return negotiated;
  }

  return LANDING_DEFAULT_LOCALE;
};
