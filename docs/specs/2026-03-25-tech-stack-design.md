# Vocabu — Tech Stack Design

## Product Summary

Vocabu is a social app for capturing and sharing short audio moments — a baby's first words, a friend's funny phrase. Users record or upload short audio clips (up to 60s), attach captions, and share them with configurable visibility: private, friends-only, or public.

### Core Features

- Audio moment capture/upload (short clips, ~60s max)
- Three visibility tiers: private, friends-only (mutual follows), public
- Follow model (one-directional). "Friends" = mutual follows (both users follow each other)
- Home feed (moments from followed users)
- Explore feed (discover public moments)
- Magic link authentication (passwordless)
- Offline-capable PWA (works without internet, syncs when online)

---

## Tech Stack

### Framework: Nuxt 4 (Vue 3)

**Why:** Full-stack Vue framework with hybrid rendering — SSR for public/explore pages (fast first paint, SEO), SPA-mode for authenticated views. File-based routing, auto-imports, Nitro server engine for API routes.

**Alternatives considered:**

- Astro + Vue islands — rejected: Astro is content-site focused, islands architecture makes shared state (auth, audio player) awkward. Vocabu is 90% interactive.
- SvelteKit — viable but different ecosystem; Vue has larger community and more ready-made modules for auth, S3, PWA.

### Deployment: Vercel

**Why:** Zero-config deployment for Nuxt (auto-detected preset). Free tier covers early development and validation (100GB bandwidth, 100K function invocations/mo). Edge network for low-latency SSR.

**Migration path:** Nuxt supports switching deployment targets via `nitro.preset` — can move to Cloudflare Pages or self-hosted (Docker/Coolify on Hetzner) later with a one-line config change.

### Database: Neon (Postgres)

**Why:** Full Postgres power — JOINs for social feed queries, JSONB for flexible moment metadata, full-text search via `tsvector` for moment/caption search, CTEs for complex queries. Scales to zero on free tier (0.5GB storage, 190 compute hours/mo).

**Alternatives considered:**

- Turso (libSQL/SQLite) — strong local-first story (same engine client + server), but user already has an IndexedDB wrapper that provides PG-like API on the client, removing Turso's main advantage.
- DynamoDB — powerful at scale but relational feed queries ("moments from people I follow") require complex denormalization patterns. Wrong tool for social data.
- MongoDB Atlas — similar relational query limitations; no web offline sync solution.
- Firestore — built-in offline sync but severe query limitations (no JOINs), unpredictable pricing, deep Google lock-in.

### Client-Side Storage: IndexedDB (user's existing wrapper)

**Why:** User has a pre-built wrapper over IndexedDB that exposes a PG-like API. Handles local caching for offline-capable experience.

**Sync pattern:**

```
[User action] → [IndexedDB] → [background sync] → [Neon Postgres]
                     ↑ reads from local first
```

Conflict resolution: last-write-wins (sufficient for this data model).

### Audio Storage: Cloudflare R2

**Why:** S3-compatible API, zero egress fees (critical for audio that gets replayed often — AWS S3 charges $0.09/GB egress). 10GB free tier.

**Access pattern:** Nitro API generates presigned upload/download URLs. Audio files cached by service worker for offline playback.

### Authentication: Resend (Magic Links) + JWT Sessions

**Why:** Passwordless auth via magic links (email). Resend free tier: 3,000 emails/mo. JWT stored in HTTP-only cookies for session management.

**Flow:**

1. User enters email → API sends magic link via Resend
2. User clicks link → server verifies token, issues JWT cookie
3. Subsequent requests authenticated via JWT cookie

### PWA: @vite-pwa/nuxt

**Why:** Mature Vite PWA plugin with Nuxt integration. Provides:

- Service worker generation (Workbox-based)
- App shell precaching
- Runtime caching strategies: cache-first for audio, network-first for feed
- Install prompt (add to home screen)
- Offline fallback page

---

## Key Architecture Decisions

1. **Hybrid rendering** — SSR for public pages (explore, profiles, landing), SPA for authenticated app views. Best of both: SEO + app-like experience.

2. **Offline-capable, not offline-primary** — Cloud (Neon) is source of truth. IndexedDB caches locally for speed and offline access. Sync when connectivity returns.

3. **Zero egress audio** — R2 over S3 to avoid per-GB download costs as audio replays scale.

4. **Presigned URLs for audio** — Server never proxies audio data. Client uploads/downloads directly to R2 via time-limited presigned URLs. Keeps server functions lightweight.

5. **Follow model over mutual friends** — Simpler to implement, better for content discovery and growth. "Friends-only" visibility = visible to mutual follows (both users follow each other).

---

## Supporting Stack

### ORM & Migrations: Drizzle ORM + drizzle-kit

**Why:** Type-safe, lightweight, first-class support for Neon's serverless driver (`@neondatabase/serverless`). `drizzle-kit` handles schema migrations. Generates raw SQL migrations that can be reviewed before applying.

### Styling: UnoCSS

**Why:** Atomic CSS engine (Tailwind-compatible) with Nuxt module (`@unocss/nuxt`). Faster than Tailwind in development, smaller output, built-in icon support.

### State Management: Pinia

**Why:** Official Vue state store. Handles auth state, audio player state, feed cache. Built into Nuxt via `@pinia/nuxt` module.

### Audio Constraints

- **Accepted formats:** WebM/Opus (browser recording), MP4/AAC (uploaded files)
- **Max file size:** 5MB
- **Max duration:** 60 seconds
- **Validation:** Client-side check before upload + server-side validation of file size and MIME type via the presigned URL policy

### Rate Limiting: Upstash Redis

**Why:** Serverless Redis with free tier (10K commands/day). Sliding window rate limiter on `/api/auth/magic-link` to prevent email abuse. Upstash has a Nuxt module (`@upstash/redis`).

### Monitoring: Sentry + Vercel Analytics

- **Sentry** — error tracking, free tier: 5K errors/mo. Nuxt SDK available.
- **Vercel Analytics** — web vitals (LCP, FID, CLS) for free on all plans.

### Testing

- **Vitest** — unit/integration tests (built into Nuxt ecosystem)
- **Playwright** — E2E tests for critical flows (auth, upload, feed, offline)
- Focus areas: sync logic, conflict resolution, auth flow, audio upload/playback

### CI/CD: GitHub Actions + Vercel

- **On PR:** lint + typecheck + Vitest + Playwright
- **On merge to main:** Vercel auto-deploys production
- **Preview deploys:** auto only for `dev`; other branches opt in by ending
  the head commit subject with `[preview]` (`scripts/vercel-ignore.js`)

---

## Stack Summary (Complete)

| Layer          | Technology                   | Free Tier                     |
| -------------- | ---------------------------- | ----------------------------- |
| Framework      | Nuxt 4 (Vue 3)               | —                             |
| Deployment     | Vercel                       | 100GB BW, 100K invocations/mo |
| Database       | Neon (Postgres)              | 0.5GB, 190 compute hrs/mo     |
| ORM            | Drizzle ORM + drizzle-kit    | —                             |
| Client storage | IndexedDB (existing wrapper) | —                             |
| Audio storage  | Cloudflare R2                | 10GB storage, zero egress     |
| Auth emails    | Resend                       | 3,000 emails/mo               |
| Rate limiting  | Upstash Redis                | 10K commands/day              |
| PWA            | @vite-pwa/nuxt               | —                             |
| Styling        | UnoCSS                       | —                             |
| State          | Pinia                        | —                             |
| Monitoring     | Sentry + Vercel Analytics    | 5K errors/mo                  |
| Testing        | Vitest + Playwright          | —                             |
| CI/CD          | GitHub Actions + Vercel      | 2K mins/mo                    |
