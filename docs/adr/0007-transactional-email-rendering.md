# ADR-0007: transactional emails are hand-rolled inline-styled HTML, localized server-side

- Status: Accepted
- Date: 2026-07-17
- Refs: VKB-55, ADR-0004, ADR-0006, `server/utils/emails/`,
  `server/utils/request-locale.ts`, `server/utils/email.ts`

## Context

The magic-link email was a bare English text body — the first thing a new user
sees, and it reads as phishy (VKB-55). Making it branded and localized forces
three decisions with no prior ADR: how to render HTML that survives email
clients (which strip `<style>` and drop `var()` custom properties, so the
design-system tokens cannot be reused the way `.vue`/CSS do), how to translate
server-side (vue-i18n's `t()` is a client-only render-runtime API, absent from
Nitro handlers), and how far to build — one email or a transactional framework.

## Decision

Each transactional email is a hand-rolled, table-based HTML string with **inline
`style` attributes** and a plain-text fallback, produced by a small pure render
function (`server/utils/emails/magic-link.ts`) over a thin reusable shell
(`server/utils/emails/shell.ts`: the branded document, the copy lookup, and a
`{placeholder}` interpolator). No email-templating dependency. The design-system
palette is inlined as **literal hex** in `shell.ts`, each annotated with the
token it mirrors; the sign-in button uses `--primary-action #cf3a60` (AA-safe on
white), **not** raw `--rose-500 #ed5379` (~3.4:1, fails WCAG AA) despite the
ticket's wording. Copy lives in the `email` namespace of `i18n/locales/*.json`
(key parity via `i18n:check`) and is read server-side by importing the catalogs
directly. Locale is resolved per request in `resolveRequestLocale` following
ADR-0004 precedence — `vocabu-locale` cookie, then `Accept-Language`, then the
default — reusing the roster, cookie key, and q-weighted negotiator extracted
into `shared/landing-locales.ts` (`pickAcceptLanguageLocale`), the same one the
landing redirect uses. Scope is magic-link only; the shell is the seam, not a
framework.

## Consequences

- The email looks like the product, in the visitor's language, with a text
  fallback for deliverability.
- The inlined palette is a **third, unguarded copy** of the tokens: `ds:check`
  scans only `.vue` + non-token CSS, never `server/`, so nothing enforces
  parity with the manifest. The token-name comments in `shell.ts` are the only
  guard — a manifest color change must be mirrored here by hand.
- The `email` keys are consumed outside `i18n:check`'s usage roots (`server/`
  is not scanned), so they surface as defined-but-unused warnings; parity and
  no-empty remain enforced.
- The token TTL is single-sourced: the handler passes `expiryMinutes`
  (`TOKEN_TTL_MINUTES`), so the "expires in N minutes" copy cannot drift from
  the real lifetime.
- The next transactional email reuses `shell.ts` and the locale resolver; if a
  third arrives, revisit whether a registry earns its keep (supersede this ADR).
- The logo is the raster PWA mark served at an absolute URL
  (`${APP_URL}/icon-192.png`); SVG is unreliable in Gmail/Outlook.

## Alternatives rejected

- **`react-email` / `mjml`** — a rendering dependency (React, in a Vue app) for
  one email; clients strip `<style>`/`var()` so tokens must be inlined either
  way, removing most of its value. Over-engineering for the pattern's sake.
- **Reuse vue-i18n server-side** — it is client-only; standing up a second
  i18n runtime in Nitro to render one email is disproportionate.
- **Default anonymous requests straight to English** — `Accept-Language` is the
  best signal when no cookie exists yet and matches how the landing treats a
  first visit; jumping to English discards it.
- **A generic transactional-email layer now** — speculative infrastructure with
  no second consumer; filed as follow-up if digests/notifications land.
