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
| M12 | Media pipeline spike            | ⏳ planned | `m12` | 20s 4K60 iPhone .mov: presigned PUT → async ffmpeg → 720p + poster → plays; ADR on transcode location |
| M13 | Entries + media schema & API    | ⏳ planned | `m13` | `db:migrate` creates `entries`+`media`; API lifecycle create → upload → processing → ready  |
| M14 | App shell (chrome)              | ⏳ planned | `m14` | BottomNav/TopBar tabs render in both themes; `ds:check` green                               |
| M15 | Feed (read path)                | ⏳ planned | `m15` | seeded entries render with media playback; empty state; `processing` placeholder           |
| M16 | Compose (write path)            | ⏳ planned | `m16` | phone: compose → upload 20s video → feed shows processing → ready → plays                  |

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

## Media core (M12–M16) — the product itself

Media (a ≤20s audio or video **moment** of the speaker) is the killer feature;
it is de-risked first (M12) and every screen builds around it. Decisions
settled 2026-07-17 (details in the M12 ADR once the spike lands):

- **Upload-first, no in-browser recording** in v1 — moments are captured
  spontaneously with the dictaphone/camera and uploaded as files (any format,
  audio or video).
- **Entity is `media`** (kind `audio | video`), limits ≤20s / ~250MB original.
- **Pipeline:** presigned PUT of the original as-is to R2 `originals/`
  (direct, bypassing the server) → entry visible as `processing` → async
  ffmpeg normalization → `ready`. Originals kept forever as source of truth.
- **Derivatives:** video → 720p H.264/AAC + poster frame (720p for now —
  revisit when there's revenue); audio → one canonical format (opus vs m4a
  decided in the spike); both → duration; audio → waveform peaks.
- **Two buckets per stage** (architecture review 2026-07-17):
  `vocabu-originals-<stage>` — fully private ingest (presigned PUT only,
  lifecycle sweeps stale multiparts and orphaned uploads) and the media
  bucket — derivatives + posters + avatars, GET-only CORS, future candidate
  for an R2 custom domain / CDN. Per-bucket scoped R2 tokens. Renames while
  it's cheap: `vocabu-audio-local` → `vocabu-media-local`,
  `vocabu-medea-*` → `vocabu-media-*`.
- **Size enforcement:** presigned PUT signs `Content-Length` alongside
  `Content-Type`; confirm re-checks `head.ContentLength`; presign endpoint
  rate-limited.
- **Open questions the spike answers:** where transcoding lives — ffmpeg in
  a Vercel function (a 20s 4K60 HEVC clip must fit the 300s limit; explicit
  `maxDuration`, plan allows it, ffmpeg binary fits the bundle) vs
  Cloudflare Stream as fallback — and the async trigger (QStash first
  candidate vs R2 events → CF Queues; QStash to be discussed with the owner
  before it's final).

Linear: VKB-63 (spike) → VKB-64 (schema/API) → VKB-65 (shell) → VKB-66
(feed) → VKB-67 (compose).

## Out of scope for v0

In-browser recording, follows, IndexedDB sync, friends-only visibility.

## Closed before M10 (hardening pass)

- ✅ GitHub Actions CI (lint + fmt:check + typecheck + ds:check + proto:check).
- ✅ Sentry source-map upload, gated on `SENTRY_AUTH_TOKEN` (deploy build only).
- ✅ Migration runner on deploy (`vercel-build` → guarded `drizzle-kit migrate`).
- ✅ Cleanup of expired `magic-link-tokens` — lazy delete-on-write in
  `magic-link.post` (replaced the original nightly Vercel cron, VKB-53;
  an admitted crutch until tokens live in a store with native TTL).
- ✅ IP-based rate limit on `/api/auth/callback` (dedicated bucket, fail-open).
- ✅ Friendly `/offline` restored via `injectManifest`: custom service worker
  routes navigations through Workbox and `setCatchHandler` returns an inline,
  self-contained offline page on a failed navigation (never while online).
- ✅ E2E Playwright smoke tests (landing / login / offline).

## Still deferred (need external action)

All three closed on 2026-07-07:

- ✅ Vercel env vars populated: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  `SENTRY_PROJECT` in Production + Preview (VKB-22). `CRON_SECRET` was set
  too, then retired with the cron itself (VKB-53).
- ✅ Resend domain verified on `words.myka.me` (VKB-23) — migrated to
  `vocabu.myka.me` in VKB-54.
- ✅ R2 admin-scoped API token created; `r2:cors:*` applied CORS to both
  buckets (VKB-24).
