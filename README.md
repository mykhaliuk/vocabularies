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
| Lint / Format / Typecheck | OxLint / Oxfmt / `tsc --noEmit`                        |

Implementation is plain JavaScript with co-located `.d.ts` for type contracts (see `docs/specs/2026-03-27-js-dts-convention.md`).

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
| `dev`     | Neon `dev` branch     | R2 `vocabu-medea-dev`     | Resend sandbox sender             | enabled    | enabled  |
| `preprod` | Neon `preprod` branch | R2 `vocabu-medea-preprod` | Resend `auth@vocabu.myka.me`      | enabled    | enabled  |

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
| `bun run typecheck`                         | `tsc --noEmit`                                |
| `bun run db:generate`                       | Generate Drizzle migrations from schema       |
| `bun run db:migrate` / `:dev` / `:preprod`  | Apply migrations to the chosen stage          |
| `bun run db:dump:dev`                       | Dump dev DB schema + data into local Postgres |

All stage-scoped scripts go through `scripts/with-env.js`, which loads `.env.<stage>` into `process.env` before spawning the inner command.

## Local ports

- Postgres: `localhost:5433` (mapped from container `5432`)
- MinIO S3 API: `localhost:9100`
- MinIO console: `localhost:9101` (`minioadmin` / `minioadmin`)

> Defaults remapped from `5432`/`9000`/`9001` to avoid colliding with other projects on the same host.

## Project layout

```
docs/specs/        Design specs (tech stack, DX, JS+.d.ts convention)
db/schema/         Drizzle schema (tables + indexes)
db/migrations/     Generated SQL migrations
server/api/        Nitro API routes
server/utils/      Server-side factories (db, storage, redis, email, auth, ratelimit)
pages/             Nuxt pages
scripts/           with-env.js wrapper, db-dump-dev.js
docker-compose.yml Local Postgres + MinIO + bucket-init
```
