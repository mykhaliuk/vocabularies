# ADR-0004: i18n `no_prefix` — locale is cookie/header state, not URL

- Status: Accepted
- Date: 2026-07-13
- Refs: PR #59 (`7414173`), `nuxt.config.js` `i18n` block, `pages/me.vue`

## Context

Vocabu is a single-domain, mobile-first PWA behind a login — not a
content site competing for per-language search traffic. `@nuxtjs/i18n`
defaults to URL-prefix routing (`/fr/...`), which doubles the route table,
complicates the PWA scope/manifest, and encodes into every URL a fact that
is really per-user preference state.

## Decision

`strategy: 'no_prefix'`: i18n routing is skipped entirely. SSR reads
`Accept-Language` on first visit; an explicit choice is written to the
`vocabu-locale` cookie, which then wins on every later request. `setLocale()`
re-renders in place. This mirrors the theme-override pattern (explicit
choice persists, OS/browser default otherwise).

## Consequences

- One URL space: deep links, the SW scope, and the manifest are
  locale-agnostic.
- Locale is invisible to crawlers — acceptable for an app behind auth; the
  public landing is English-first.
- Messages are lazy-loaded, so `setLocale()` can reject (network) — callers
  must `await` it in try/catch.
- ROADMAP's earlier M11 sketch (`/fr`, `/uk` prerendered landing variants)
  is superseded by this for the app; if per-locale static landings ever
  ship, they are a separate decision scoped to `/` only.

## Alternatives rejected

- **`prefix_except_default`** — URL churn and PWA-scope complexity for zero
  SEO benefit behind a login wall.
- **Separate domains/subdomains per locale** — operational overhead absurd
  for a personal-dictionary PWA.
