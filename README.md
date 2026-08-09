# Vocabu

Social app for capturing and sharing short audio moments. PWA, offline-capable.

> **Status:** scaffold. Smoke-test app exercising the full stack across local/dev/preprod. No product features yet — see `docs/specs/` and `~/.claude/plans/1-could-be-bun-floofy-moon.md` for the build plan.

## Stack

| Layer                     | Tech                                                   |
| ------------------------- | ------------------------------------------------------ |
| Framework                 | Nuxt 4 (Vue 3)                                         |
| Runtime                   | Node 24                                                |
| Package manager           | Bun                                                    |
| Hosting                   | Vercel                                                 |
| DB                        | Postgres — Neon (cloud) / Docker (local)               |
| ORM                       | Drizzle                                                |
| Audio storage             | Cloudflare R2 (cloud) / MinIO (local), S3 API          |
| Auth                      | Magic links (Resend) + JWT cookie + revocable sessions |
| Rate limit                | Upstash Redis                                          |
| Monitoring                | Sentry                                                 |
| Lint / Format / Typecheck | OxLint / Oxfmt / `nuxt typecheck`                      |

Application code is TypeScript. Standalone `scripts/*.js` stay plain JS — they are excluded from typecheck and run with plain node. The original JS + co-located `.d.ts` convention was retired on 2026-07-07; see `docs/specs/2026-03-27-js-dts-convention.md` for why.

## Prerequisites

- Node 24+ (`.nvmrc` pinned)
- Bun 1.3+
- Docker Desktop (for local stage)
- `pg_dump` 18 client (for `db:dump:dev`; matches Neon's major version)

## Environments

Three stages, each with its own `.env.<stage>` (gitignored). Copy `.env.example` to scaffold a new one.

| Stage     | DB                    | Storage                   | Auth email                        | Rate limit | Sentry   |
| --------- | --------------------- | ------------------------- | --------------------------------- | ---------- | -------- |
| `local`   | Docker Postgres       | Docker MinIO              | bypassed (link logged to console) | disabled   | disabled |
| `dev`     | Neon `dev` branch     | R2 `vocabu-media-dev`     | Resend sandbox sender             | enabled    | enabled  |
| `preprod` | Neon `preprod` branch | R2 `vocabu-media-preprod` | Resend `auth@vocabu.myka.me`      | enabled    | enabled  |

## Quick start (local)

```sh
bun install                # also runs `nuxt prepare`
bun run start:local        # boots Docker (Postgres + MinIO + bucket), then nuxt dev
```

Open http://localhost:3000 — health check at http://localhost:3000/api/health.

To run against a cloud stage instead:

```sh
bun run start:dev          # local nuxt → dev cloud (Neon dev, R2 dev, etc.)
bun run start:preprod      # local nuxt → preprod cloud
```

## Scripts

| Script                                      | What it does                                  |
| ------------------------------------------- | --------------------------------------------- |
| `bun run start:local` / `:dev` / `:preprod` | Run nuxt dev with the matching `.env.<stage>` |
| `bun run infra:up`                          | Start Docker Postgres + MinIO + create bucket |
| `bun run infra:down`                        | Stop Docker stack (data preserved)            |
| `bun run infra:reset`                       | Stop and wipe volumes                         |
| `bun run build`                             | Build for production                          |
| `bun run preview`                           | Preview production build                      |
| `bun run lint`                              | OxLint                                        |
| `bun run fmt` / `fmt:check`                 | Oxfmt                                         |
| `bun run typecheck`                         | `nuxt typecheck` (`vue-tsc -b --noEmit`)      |
| `bun run ds:check`                          | Design system sync                            |
| `bun run proto:check`                       | Prototype vs design system drift              |
| `bun run i18n:check`                        | i18n key parity                               |
| `bun run layering:check`                    | Server layering rules                         |
| `bun run graph:check`                       | Capability graph freshness                    |
| `bun run test:unit`                         | Unit tests (`bun test tests/unit`)            |
| `bun run test:e2e`                          | Playwright E2E smoke tests                    |
| `bun run test:e2e:authed`                   | Authed E2E (boots Docker + migrates)          |
| `bun run db:generate`                       | Generate Drizzle migrations from schema       |
| `bun run db:migrate` / `:dev` / `:preprod`  | Apply migrations to the chosen stage          |
| `bun run db:dump:dev`                       | Dump dev DB schema + data into local Postgres |

All stage-scoped scripts go through `scripts/with-env.js`, which loads `.env.<stage>` into `process.env` before spawning the inner command.

`typecheck` delegates to Nuxt's own wrapper: it regenerates the `.nuxt/tsconfig.*.json` project references, then runs `vue-tsc` in build mode. A bare `tsc --noEmit` is **not** equivalent — the root `tsconfig.json` carries an empty `files` array plus `references`, so without `-b` it checks nothing and exits 0.

CI runs the same gates, split across three jobs. `checks` runs `ds:check`, `proto:check`, `i18n:check`, `layering:check`, `graph:check`, `lint`, `fmt:check`, `typecheck` and `test:unit` — running that list locally reproduces it exactly. `e2e` runs `test:e2e`. `e2e-authed` runs the authenticated suite against a seeded Postgres service container; locally the equivalent is `test:e2e:authed`, which boots Docker and migrates first. See `.github/workflows/ci.yml`.

## Local ports

- Postgres: `localhost:5433` (mapped from container `5432`)
- MinIO S3 API: `localhost:9100`
- MinIO console: `localhost:9101` (`minioadmin` / `minioadmin`)

> Defaults remapped from `5432`/`9000`/`9001` to avoid colliding with other projects on the same host.

## Project layout

**Client.** `pages/` are the file-based routes, `layouts/` the shells they opt into, `middleware/` the `auth` route guard they name in `definePageMeta`. `components/` groups the Vue components per surface — `app/`, `compose/`, `entry/`, `feed/`, `landing/` — beside the `V*` primitives. `composables/` and `utils/` are both auto-imported: `use*` composables in the first, plain functions in the second. `assets/css/` carries the design tokens and global styles; components reach them through `var()` instead of raw hex literals, which `ds:check` enforces (annotate a deliberate exception with `ds-allow-hex`). `public/` is served verbatim at the root. `service-worker/` is the `injectManifest` PWA worker plus the self-contained offline page it serves. `i18n/locales/` holds the `en`/`fr`/`uk` messages, kept in parity by `i18n:check`.

**Server**, in the three layers of ADR-0010. `server/api/` and `server/plugins/` are transport: validation, auth, rate limits, HTTP mapping, calling the domain rather than the db. `server/domain/` owns every db access as a named domain operation. `server/utils/` is infra — the db, storage, redis and email resources plus platform helpers. `layering:check` enforces the boundary; a shrink-only allowlist grandfathers the pre-ADR-0010 routes.

**Shared.** `shared/` is what both sides import: locales, media types, cache names and the other rosters declared once instead of hand-synced.

**Data.** `db/schema/` is the Drizzle schema, `db/migrations/` the generated SQL and its journal. `docker-compose.yml` brings up the local Postgres and MinIO.

**Scripts.** `scripts/` is every repo script, ESM run with plain node: the `with-env.js` stage wrapper, the gates CI runs (`ds-check.js`, `proto-check.js`, `i18n-check.js`, `layering-check.js`, `capability-graph.js`) and maintenance one-offs.

**Tests**, split by the infra they need. `tests/unit/` runs under `bun test` with none (fixtures in `tests/assets/`). `e2e/*.spec.ts` is the DB-free Playwright smoke suite, `e2e/authed/` the authenticated one against a migrated Postgres, `e2e/local/` the MinIO + transcoding runner that never runs in CI.

**Docs.** `docs/adr/` is the decision log, `docs/GLOSSARY.md` the vocabulary, `docs/PR-CHECKLIST.md` the pre-PR routine; `docs/capability-graph.md` is generated, never hand-edited. `docs/design/` holds the design-system export, the prototype and design proposals. `docs/specs/` are dated specs kept as historical records — one of them is retired, so read the status banner before trusting a line.
