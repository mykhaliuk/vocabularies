# Local-only integration tests (poll/claim sign-in VKB-70, compose VKB-67)

These tests exercise the installed-PWA poll/claim sign-in flow and the compose
write path end to end. They
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
4. runs `poll-entry.client.mjs` — the VKB-70 QA fixes (entry routing + code-field
   UX): a signed-out forced-standalone context redirects `/` and `/fr` to
   `/login`, while a signed-in one resolves `/` to `/me` and an authenticated
   visitor on `/login` is sent to `/me`; `/login` shows the confirmation-code
   field immediately on send; and a failed confirm never strands — both a submit
   before the link is opened and a claim locked by burning the 3-attempt cap keep
   the code screen, the honest guidance message, a reachable "ask for a new link",
   and the poll key, after which the real code still signs the PWA in (re-adding
   a `clear()` on a failed confirm fails these); a non-standalone `/login` and
   the landing show the plain message with no code field and no redirect,
5. runs `compose.client.mjs` — the VKB-67 compose write path: a signed-in
   desktop jar composes a text-only word and one with a generated 1s WAV
   fixture; both appear in the feed without a reload, and the voice entry is
   polled to `ready` in place (counting the feed's own `/api/entries` GETs, so
   the postedVersion → merge → poll-restart chain leaves evidence). The
   free-tier video gate is exercised against the real server verdict
   (403 `VIDEO_UPLOAD_FORBIDDEN` → the premium branch and sheet), never a
   client guess. Needs MinIO and the inline (no-QStash) transcode path — both
   part of the same `infra:up` local stack,
6. tears the dev server down.

`helpers.mjs` holds the shared standalone-signal init script and the
click-and-read-code helper used by both client suites.

Exit code is non-zero if any assertion fails.

## What still needs a real device

The actual iOS standalone-PWA jar isolation (the reason the flow exists) can
only be confirmed on an iPhone with the app added to the Home Screen. These
tests simulate the isolation with separate browser contexts; they prove the
mechanism, not the on-device jar boundary.
