# ADR-0002: expired magic-link tokens are swept lazily on write, not by cron

- Status: Accepted
- Date: 2026-07-07
- Refs: PR #57 (`33ac625`), VKB-53, `server/api/auth/magic-link.post.ts`

## Context

Expired magic-link tokens are hygiene, not correctness: the callback checks
`expiresAt` itself, so stale rows can't be used — they just accumulate. The
table only grows when someone requests a login link. The original nightly
Vercel cron required a dedicated endpoint, a `vercel.json` schedule, and
`CRON_SECRET` machinery for a table that grows by a handful of rows a day.

## Decision

Delete expired rows in `magic-link.post` right before inserting the new
token. No cron endpoint, no schedule, no shared secret.

## Consequences

- Cleanup work is proportional to login traffic — exactly the traffic that
  creates the rows.
- The table is never swept during a quiet period; that is acceptable because
  stale rows are inert.
- **Admitted crutch with a recorded exit:** when tokens move to a store with
  native TTL (Redis `SET .. EX` + `GETDEL`), the sweep is deleted outright.

## Alternatives rejected

- **Vercel cron** — an endpoint + schedule + secret to maintain for a
  hygiene task; disproportionate.
- **pg_cron** — never fires on Neon's scale-to-zero compute; the database
  is asleep exactly when the cron would run.
