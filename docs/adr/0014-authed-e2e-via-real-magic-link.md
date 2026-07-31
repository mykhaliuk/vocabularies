# ADR-0014: authed e2e sessions come from the real magic-link flow, read out of a mirrored server log

- Status: Accepted
- Date: 2026-07-31
- Refs: VKB-101

## Context

Every screen from M17 on sits behind `middleware: 'auth'`, and CI could not
reach a single one: the smoke suite deliberately covers only routes that render
with no DB, so "an e2e spec per UI ticket" was unenforceable. Giving CI a
Postgres is the easy half. The hard half is the session, and it has exactly one
awkward constraint: the database stores only the **hash** of a magic-link token,
so a test can never recover the raw token from the DB. The link exists in
precisely one readable place — the console emailer's stdout — and a Playwright
spec cannot read the stdout of a server Playwright itself spawned.

## Decision

The authed suite signs in the way a user does: POST `/api/auth/magic-link`,
open the emailed link, let the callback set `vocabu_session` on the browser
context. To make the link readable, the suite's webServer command is
`scripts/e2e-server.js`, which runs the built app and mirrors its output to
`tmp/e2e-authed-server.log`; the fixture scans that file for the line carrying
its own address. It lives in a second Playwright config
(`playwright.authed.config.ts`), not a second project in the existing one, so
the smoke suite keeps its own infra-free webServer unconditionally.

## Consequences

- A broken sign-in path fails this suite. That is the point: the session is the
  thing most likely to rot, and a forged cookie would have made the harness
  green through an auth regression.
- No test-only surface in production code — no seeding endpoint, no second
  email driver, nothing shipped that exists for tests.
- The suite is welded to two implementation details: the console emailer's line
  format, and `APP_ENV=local` selecting it. Both are asserted loudly (the config
  refuses to start on the wrong stage or with Resend credentials present) rather
  than left to fail as a timeout.
- Sign-in costs ~1s per test. Fine at this size; if the suite grows to where
  that hurts, the fix is a cached `storageState` per worker, not a forged
  cookie.
- Both suites build into the same `.output`, so locally they run one at a time.

## Alternatives rejected

- **Seed a session row + sign the JWT in test code** — fastest, and what the
  ticket originally suggested. Rejected: it duplicates `server/utils/auth.ts`
  internals in the harness, so a change to session shape or cookie semantics
  breaks real login while the harness stays green — the exact failure a green
  CI is supposed to prevent.
- **A test-only sign-in endpoint** — a permanent auth bypass in the deployed
  app, guarded only by an env check. Not worth it for a build-time convenience.
- **Extend `e2e/local/run.mjs`** (the audit's suggested path) — it already
  resolves links from a dev server it owns. Rejected because it is a bespoke
  runner with hand-rolled assertions and a `nuxt dev` server; UI tickets should
  be writing ordinary Playwright specs against a production build, not adding
  cases to a custom harness.
- **One config with two projects** — sharing the smoke suite's webServer would
  make the DB-free suite depend on infra, or make it conditional. The ticket
  asks for the opposite.
