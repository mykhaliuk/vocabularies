# Local-only integration tests (poll/claim sign-in, VKB-70)

These tests exercise the installed-PWA poll/claim sign-in flow end to end. They
need a **live Postgres** and the **console email driver**, so they are **not**
part of the CI e2e suite (`bun run test:e2e`), which deliberately covers only
DB-free routes so CI needs no infra. They are excluded from the Playwright
collection via `testIgnore` in `playwright.config.ts` and never run in CI.

## Run

```sh
bun run test:poll-claim
```

That runs `infra:up` (OrbStack Postgres + MinIO) and then, under the local env,
`e2e/local/run.mjs`, which:

1. spawns a dev server and captures its stdout (the console emailer prints the
   magic link there in `local`),
2. runs `poll-claim.http.mjs` — the server invariants over HTTP: poll before
   armed → pending; unknown/absent/malformed key → pending/400; happy path →
   ready + a session cookie in the PWA's own jar; double claim → one session;
   concurrent double-poll → exactly one session; expired → pending; and the
   desktop (no-pollKey) path unchanged,
3. runs `poll-claim.client.mjs` — the Playwright cross-jar scenario: a forced
   standalone context sends + persists a poll key, a separate context opens the
   emailed link, and the first context's poll readies, receives its own
   distinct cookie, navigates to `/me`, and clears the key; plus a cold-start
   resume case,
4. tears the dev server down.

Exit code is non-zero if any assertion fails.

## What still needs a real device

The actual iOS standalone-PWA jar isolation (the reason the flow exists) can
only be confirmed on an iPhone with the app added to the Home Screen. These
tests simulate the isolation with separate browser contexts; they prove the
mechanism, not the on-device jar boundary.
