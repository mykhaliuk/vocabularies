# ADR-0006: per-locale prerendered landings (/, /fr, /uk) with an Accept-Language entry redirect

- Status: Accepted
- Date: 2026-07-16
- Refs: VKB-20, VKB-21, ADR-0004, `components/landing/copy.*.ts`,
  `server/plugins/landing-locale.ts`, `nuxt.config.js` (`routeRules`,
  `nitro.vercel.config.routes`)

## Context

ADR-0004 made the app's locale cookie/header state (`no_prefix`) and noted
that per-locale static landings, if they ever ship, are a separate decision
scoped to `/` only. That day came: the landing must be readable by French and
Ukrainian visitors AND stay fully static (prerendered HTML, Lighthouse
95+/100/100/100 mobile budget). Running `@nuxtjs/i18n`'s message runtime on
the landing would translate at hydration time — the crawler-visible HTML and
first paint would stay English, and the landing payload would grow for zero
static benefit.

## Decision

The landing is three prerendered pages: `/` (English), `/fr`, `/uk`. Copy
lives in plain data modules (`components/landing/copy.{en,fr,uk}.ts`), one
per locale so each page chunk carries only its own strings; a shared
`LandingPage` component renders a copy prop and bakes per-page head state
(`<html lang>`, localized `useSeoMeta`, canonical, `hreflang` alternates —
this is the one sanctioned exception to ADR-0004's "no per-locale URLs",
scoped to the landing). Entry routing happens server-side before the static
page is served: an explicit `vocabu-locale` cookie wins (ADR-0004's
"explicit choice persists" contract), otherwise the highest-q supported
primary tag in `Accept-Language` picks `/fr`/`/uk`, and English or anything
unsupported stays on `/`. The redirect is implemented twice on purpose, once
per serving path: `has`/`missing` edge routes in the Vercel build config
(`nitro.vercel.config.routes`, merged ahead of `handle: filesystem`, so they
run before the CDN serves the static HTML) and a Nitro `request`-hook plugin
for Node serving (preview, self-host) — a server middleware cannot work,
Nitro registers the public-assets handler ahead of middleware.

## Consequences

- Localized copy is in the prerendered HTML: full SEO, instant first paint,
  zero translation JS on the landing.
- The landing copy is deliberately OUTSIDE the i18n message files; the
  `/login`+app translations (i18n runtime) and the landing copy modules are
  two systems, and copy edits must touch the right one.
- The redirect logic exists in two places (edge routes + Nitro plugin); both
  derive from `shared/landing-locales.ts` (the roster, paths, cookie key, and
  the edge routes are generated from one module), so adding a locale is a
  type-checked change there plus a copy module and a page wrapper.
  `e2e/landing-locales.spec.ts` pins the Node side; the Vercel side is only
  checkable on a deploy.
- Vercel's edge `has` conditions can't parse q-values, so the edge leg keys
  off the first (most-preferred) Accept-Language tag; the Node leg does real
  q-ordering. Known accepted deviations of the edge leg: header order
  (`en;q=0.8,fr` serves English on Vercel, French on Node), explicit refusal
  (`fr;q=0, en` still redirects to /fr on Vercel — RE2 `has` regexes cannot
  express "q≠0" without lookaheads), and case (`FR-FR` is not matched;
  real browsers send lowercase primary subtags). The Node leg is the
  reference semantics.
- Navigations to `/` are network-first in the service worker (offline falls
  back to the precached English page), so the entry redirect and the
  `vocabu-locale` cookie are honored even for installed-PWA launches
  (start_url `/`); /fr and /uk stay precache-first and work offline.
- The landing carries a visible locale switcher (nav) whose links set
  `vocabu-locale` before navigating — the unauthenticated path to any
  locale, including back to English (without it, every path to `/` would
  redirect an fr/uk visitor straight back).
- The phone mock (`LandingPhoneMock`) stays English on all three pages — it
  depicts the product UI, not landing copy.

## Alternatives rejected

- **i18n runtime on the landing** — translates after hydration; English HTML
  for crawlers and first paint, bigger payload, against the static budget.
- **SSR-per-request landing (cookie/header rendering like the app)** — gives
  one URL but forfeits static prerender and the CDN-cached first paint.
- **Server middleware for the redirect** — dead on Vercel (CDN serves the
  static file first) and dead on Node too (public-assets handler runs before
  middleware); the request hook + edge routes are the placements that run.
- **Client-side locale sniff + `location.replace`** — flashes English,
  costs JS, and crawlers see a redirecting page.
