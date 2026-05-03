# Roadmap

Smoke-test scaffold (v0). Each milestone is independently verifiable and tagged in git as `m<N>`.

Detailed plan: `~/.claude/plans/1-could-be-bun-floofy-moon.md` (not committed).

| #   | Milestone                     | Status  | Tag  | Verification                                                 |
| --- | ----------------------------- | ------- | ---- | ------------------------------------------------------------ |
| M1  | Skeleton + tooling            | ✅ done | `m1` | `bun run start:local` → `/` shows "hi there"                 |
| M2  | Local infra + health endpoint | ✅ done | `m2` | `/api/health` → `{db:ok, storage:ok, redis:skipped}`         |
| M3  | Drizzle schema + migrations   | ✅ done | `m3` | 3 tables + unique index on `lower(email)` after `db:migrate` |
| M4  | Magic-link auth E2E           | ✅ done | `m4` | login → `/me` → logout works locally; expired link 401       |
| M5  | Avatar upload                 | ✅ done | `m5` | upload PNG → reload `/me` → avatar renders                   |
| M6  | Sentry + debug error          | ✅ done | `m6` | dev: error in Sentry tagged `environment:dev`, no PII        |
| M7  | Rate limit on magic-link      | ✅ done | `m7` | dev: 6 rapid POSTs → 6th = 429                               |
| M8  | PWA                           | ✅ done | `m8` | offline page renders airplane-mode; `/me` not cached         |
| M9  | Multi-env runner + DB dump    | ✅ done | `m9` | health passes for all 3 envs; `db:dump:dev` populates local  |

## Out of scope for v0

Word/audio capture, feeds, follows, IndexedDB sync, friends-only visibility.

## Open items (deferred)

- Sentry sourcemap upload via `SENTRY_AUTH_TOKEN` in CI.
- Vercel project env-var population (manual, in Vercel UI).
- GitHub Actions CI workflow (lint + fmt:check + typecheck + tests).
- E2E Playwright tests.
- Resend domain verification on `words.myka.me`.
- Migration runner on deploy.
- Cron cleanup of expired `magic-link-tokens` rows.
- IP-based rate limit on `/api/auth/callback`.
- R2 admin-scoped API token to enable `r2:cors:*` scripts (currently CORS is configured via the Cloudflare dashboard).
