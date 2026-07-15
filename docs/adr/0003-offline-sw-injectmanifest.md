# ADR-0003: PWA offline via `injectManifest` custom service worker

- Status: Accepted
- Date: 2026-06-07
- Refs: `1662a08`, `service-worker/sw.js`, `nuxt.config.js` `pwa` block

## Context

The friendly `/offline` page must render when a navigation fails with no
network — and only then. `@vite-pwa/nuxt`'s default `generateSW` strategy
produces a generated worker whose runtime-caching options could not express
"serve the offline page as a catch handler for failed navigations, never
cache authenticated pages like `/me`" precisely enough.

## Decision

Use `strategies: 'injectManifest'` with a hand-written worker in
`service-worker/`: Workbox routes navigations and `setCatchHandler` returns
a self-contained offline page only when a navigation actually fails. The
precache manifest is still injected by the plugin.

## Consequences

- Full control over caching semantics: `/me` and other authed responses are
  never cached; the offline page never appears while online.
- The worker is our code — reviewed and testable (the offline E2E smoke
  covers it), but also ours to maintain across Workbox upgrades.
- Runtime caching policy lives in one readable file instead of generated
  config.

## Alternatives rejected

- **`generateSW`** — declarative options too coarse for the catch-handler
  behaviour; debugging a generated worker is guesswork.
- **No offline page** — a browser error screen on a flaky mobile connection
  contradicts the product's mobile-first, warm-voice contract.
