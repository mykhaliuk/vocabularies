# ADR-0008: installed PWAs sign in via a poll/claim handoff, not the link cookie

- Status: Accepted
- Date: 2026-07-19
- Refs: VKB-70, VKB-55, ADR-0002, ADR-0005,
  `server/api/auth/poll.post.ts`, `db/schema/signin-claims.ts`

## Context

An installed standalone PWA has its own cookie/storage jar, isolated from
Safari. Mail opens the magic link in Safari, so the session cookie that
`/api/auth/callback` sets lands in Safari's jar — never the PWA's. The
one-tap link therefore _structurally_ cannot authenticate the standalone PWA,
and a pure PWA cannot register the iOS universal links that would let the app
intercept the click. The magic link is the only way in (GLOSSARY), and it must
stay one-tap for desktop and browser, so the fix has to add a path for the PWA
without changing the existing link flow.

## Decision

Keep the link exactly as-is and add a **poll/claim** handoff for the PWA. The
PWA mints a 256-bit **poll key**, persists it in its own localStorage, and
sends its hash with the magic-link request; the server binds the hash to a
pending **claim** (`signin_claims`). The Safari link click signs in as today
_and_ **arms** the claim (writes the resolved `user_id`). The PWA polls
`POST /api/auth/poll` with the poll key (immediately on `visibilitychange`
when the user returns, else backoff); the first poll to find an armed,
unexpired, unclaimed claim **claims it once** and mints a session cookie into
the PWA's own jar. Only key _hashes_ are stored, mirroring the token hash. The
poll key is generated only when the client is an installed standalone PWA, so
every other client's flow is byte-identical to before — no poll key, no claim
row.

## Consequences

- **Single-issue is a guarded UPDATE.** The poll does
  `UPDATE signin_claims SET claimed_at = now() WHERE poll_key_hash = $1 AND
user_id IS NOT NULL AND claimed_at IS NULL AND expires_at > now()
RETURNING user_id`; Postgres row-locks the row, so under a double-poll race
  exactly one caller wins. Claim + session mint run in one transaction, so a
  mint failure rolls the claim back and the next poll retries — no burned
  claim, no double session.
- **No enumeration signal.** Every non-success outcome (unknown key,
  not-yet-armed, expired, already-claimed) returns the same
  `{ status: 'pending' }`. The poll never reads email or user existence, so it
  cannot leak who is registered; the anti-enumeration posture of the send
  path is preserved.
- **Bearer-secret hygiene.** The poll key is unguessable (256-bit),
  single-use (claimed once), short-TTL (15 min, shared with the token via
  `shared/magic-link.ts`), and rate-limited per IP. It is POSTed (never in a
  URL/query, so it stays out of logs, history and the SW cache), the issued
  cookie is HTTPS-only off `local` (`setSessionCookie`), and localStorage is
  cleared on success or expiry.
- **New sessions-growth site inherits the ADR-0005 sweep.** The poll is a
  second place sessions are created, so it carries the same lazy
  `DELETE WHERE expires_at < now()` sweep, fail-open, at the moment it mints.
  `signin_claims` gets the same lazy sweep as tokens (ADR-0002), on the
  magic-link write that creates claims.
- **Same recorded exit as ADR-0002/0005:** when auth state moves to a store
  with native TTL (Redis), the claim table and all three lazy sweeps are
  deleted together.
- **The PWA session reflects the PWA.** The poll mints a fresh session with
  the PWA's own user-agent/IP rather than sharing Safari's callback session,
  so each jar's session carries its own audit trail and neither dangles if the
  other logs out.

## Duplicated-logic parity (PR-CHECKLIST)

The claim lifecycle spans two request handlers; this is the reference:

| Step  | Handler           | Effect                                                    |
| ----- | ----------------- | --------------------------------------------------------- |
| bind  | `magic-link.post` | upsert `signin_claims` by `poll_key_hash`, `user_id` null |
| arm   | `callback.get`    | set `user_id` on the claim (fail-open, after sign-in)     |
| claim | `poll.post`       | guarded UPDATE sets `claimed_at`, mints session once      |

Accepted deviations: a resend reuses the same poll key, so several tokens can
share one `poll_key_hash` (`magic_link_tokens.poll_key_hash` is non-unique);
the claim is upserted, and clicking any resent link arms the one claim the PWA
polls. Arming is fail-open — if it throws, Safari is still signed in and only
the PWA auto-sign-in is lost.

**Verification — what runs where.** The poll/claim flow needs a live Postgres
and the console email driver, which the CI e2e suite deliberately does not
provision (`e2e/*.spec.ts` cover only DB-free routes — landing, login form,
offline, 404 — so CI needs no infra). So the poll/claim tests are **local-only**
and are **not** part of the `bun run test:e2e` CI gate:

- **CI (`bun run test:e2e`, no infra):** the login/inbox screen renders and the
  send button gating — the only poll/claim-adjacent surface that runs without a
  DB.
- **Local-only (`bun run test:poll-claim`, needs `infra:up` + local Postgres):**
  `e2e/local/` drives the full flow against a spawned dev server — the server
  invariants over HTTP (poll before armed → pending; unknown/absent/malformed
  key → pending/400; happy path → ready + cookie in the PWA jar; double claim →
  one session; concurrent double-poll → exactly one session; expired → pending;
  desktop path unchanged) and the Playwright cross-jar scenario (standalone
  context sends + persists a key; a separate context opens the link; the first
  context's poll readies, receives its own distinct cookie, navigates to `/me`,
  clears the key).
- **Needs a real iPhone (not automatable):** the actual iOS standalone-jar
  isolation — confirmed only with the app added to the Home Screen.

The local suite is committed under `e2e/local/` and excluded from the Playwright
CI collection (`testIgnore`), so it never runs where there is no database.

## Alternatives rejected

- **Universal links / app-intercepted click** — a pure PWA (no native app)
  cannot register them on iOS; the whole reason the link lands in Safari.
- **BroadcastChannel / storage events between Safari and the PWA** — the two
  jars are isolated by design; no shared channel exists to relay the session.
- **Poll key + ready state on `magic_link_tokens`** — the callback deletes the
  token row (deletion _is_ consumption, ADR-0002), so the ready claim could
  not survive the click; a sibling table that outlives token consumption is
  required.
- **`GET /api/auth/poll?key=…`** — puts the bearer secret in the URL (server
  logs, history) and lets the SW's `/api/*` NetworkFirst cache the response;
  POST keeps the secret in the body and bypasses SW GET caching.
- **Attach the PWA to the callback's session** (claim stores `session_id`) —
  simpler, but the PWA session would then carry Safari's user-agent/IP and
  dangle if that session were deleted; minting a fresh session per jar is
  cleaner.
