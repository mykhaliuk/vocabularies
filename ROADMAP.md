# Roadmap

Smoke-test scaffold (v0). Each milestone is independently verifiable and tagged in git as `m<N>`.

Detailed plan: `~/.claude/plans/1-could-be-bun-floofy-moon.md` (not committed).

| #   | Milestone                       | Status     | Tag   | Verification                                                                                |
| --- | ------------------------------- | ---------- | ----- | ------------------------------------------------------------------------------------------- |
| M1  | Skeleton + tooling              | ✅ done    | `m1`  | `bun run start:local` → `/` shows "hi there"                                                |
| M2  | Local infra + health endpoint   | ✅ done    | `m2`  | `/api/health` → `{db:ok, storage:ok, redis:skipped}`                                        |
| M3  | Drizzle schema + migrations     | ✅ done    | `m3`  | 3 tables + unique index on `lower(email)` after `db:migrate`                                |
| M4  | Magic-link auth E2E             | ✅ done    | `m4`  | login → `/me` → logout works locally; expired link 401                                      |
| M5  | Avatar upload                   | ✅ done    | `m5`  | upload PNG → reload `/me` → avatar renders                                                  |
| M6  | Sentry + debug error            | ✅ done    | `m6`  | dev: error in Sentry tagged `environment:dev`, no PII                                       |
| M7  | Rate limit on magic-link        | ✅ done    | `m7`  | dev: 6 rapid POSTs → 6th = 429                                                              |
| M8  | PWA                             | ✅ done    | `m8`  | offline page renders airplane-mode; `/me` not cached                                        |
| M9  | Multi-env runner + DB dump      | ✅ done    | `m9`  | health passes for all 3 envs; `db:dump:dev` populates local                                 |
| M10 | i18n core (En/Fr/Uk) + switcher | ⏳ planned | `m10` | device locale `fr` → app loads in French; switch to Uk in settings → persists across reload |
| M11 | Localized landing (per-locale)  | ⏳ planned | `m11` | `/`, `/fr`, `/uk` prerender to static HTML; mobile Lighthouse still 95+/100/100/100         |

## Internationalization (M10–M11)

Stack: **`@nuxtjs/i18n`** (official module — per-locale prerender, `Accept-Language`
auto-detect, lazy translation chunks, SEO tags out of the box). Locales: **En**
(default), **Fr**, **Uk**.

- **Detection**: device locale on first visit via `Accept-Language` (SSR), then a
  cookie persists the explicit choice — mirrors the existing synchronous theme-override
  pattern in `nuxt.config.js` (`app.head.script`).
- **App**: in-app settings switcher writes the locale cookie; `/me`, `/login`, settings
  re-render in the chosen language. Translation messages lazy-loaded per locale.
- **Landing (perf-preserving)**: keep it fully static — prerender one HTML per locale
  (`/`, `/fr`, `/uk`) so copy is baked in with **zero client-side translation JS**; each
  page keeps its current Lighthouse. Entry locale routed by `Accept-Language` redirect.
- **Fonts caveat**: self-hosted set is currently `subsets: ['latin']`; Ukrainian needs
  Cyrillic — extend to `['latin', 'cyrillic-ext']`, scoped so it does not inflate the
  render-blocking weight of the En/Fr landing variants.

## Out of scope for v0

Word/audio capture, feeds, follows, IndexedDB sync, friends-only visibility.

## Closed before M10 (hardening pass)

- ✅ GitHub Actions CI (lint + fmt:check + typecheck + ds:check + proto:check).
- ✅ Sentry source-map upload, gated on `SENTRY_AUTH_TOKEN` (deploy build only).
- ✅ Migration runner on deploy (`vercel-build` → guarded `drizzle-kit migrate`).
- ✅ Cron cleanup of expired `magic-link-tokens` (bearer-protected
  `/api/cron/cleanup-tokens`, nightly via `vercel.json`).
- ✅ IP-based rate limit on `/api/auth/callback` (dedicated bucket, fail-open).
- ✅ Friendly `/offline` restored via `injectManifest`: custom service worker
  routes navigations through Workbox and `setCatchHandler` returns an inline,
  self-contained offline page on a failed navigation (never while online).
- ✅ E2E Playwright smoke tests (landing / login / offline).

## Still deferred (need external action)

- Vercel project env-var population, incl. `CRON_SECRET`, `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT` (Vercel UI).
- Resend domain verification on `words.myka.me` (DNS).
- R2 admin-scoped API token to enable `r2:cors:*` scripts (currently CORS is
  configured via the Cloudflare dashboard).
