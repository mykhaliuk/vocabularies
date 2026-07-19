# ADR-0008: installed PWAs sign in via poll/claim + a click-revealed code

- Status: Accepted
- Date: 2026-07-19
- Refs: VKB-70, VKB-55, ADR-0002, ADR-0005,
  `server/api/auth/callback.get.ts`, `server/api/auth/poll.post.ts`,
  `server/api/auth/confirm.post.ts`, `db/schema/signin-claims.ts`

## Context

An installed standalone PWA has its own cookie/storage jar, isolated from
Safari. Mail opens the magic link in Safari, so the session cookie that
`/api/auth/callback` sets lands in Safari's jar — never the PWA's. The
one-tap link therefore _structurally_ cannot authenticate the standalone PWA,
and a pure PWA cannot register the iOS universal links that would let the app
intercept the click. The magic link is the only way in (GLOSSARY), and it must
stay one-tap for desktop and browser, so the fix has to add a path for the PWA
without changing the existing link flow.

**The naive handoff opens a session-fixation / login-CSRF hole.** If the PWA
just mints a poll key, the server arms the claim on any click, and the PWA's
poll then mints the session, then whoever holds the poll key collects the
session of whoever clicks. An attacker can pick a poll key, get a victim to
open an attacker-initiated magic link (or open the attacker's own link and
hand the key to the victim's session), and the attacker's PWA — polling that
key — receives the **victim's** authenticated session. The click authorizes a
sign-in, but nothing binds _who clicked_ to _who receives the session_.

## Decision

Keep the link one-tap and add a **poll/claim** handoff **gated by a
confirmation code shown only on the click page**. The PWA mints a 256-bit
**poll key**, persists it in its own localStorage, and sends its hash with the
magic-link request; the server binds the hash to a pending **claim**
(`signin_claims`). The Safari click signs the clicker into Safari as today
_and_ **arms** the claim: it sets `user_id` plus a hashed **confirmation code**
with its own short window, and renders that code — in plaintext, in the page
body only — to the clicker. The PWA polls `POST /api/auth/poll`, which now only
_reports_ state (`pending` / `confirm`, never the code). Once armed, the PWA
shows a code input; the user types the code they see on the click page and
`POST /api/auth/confirm` verifies it, claims the row exactly once, and mints
the session cookie into the PWA's own jar. The poll key is generated only for
an installed standalone PWA on `/login`, so every other client's flow is
byte-identical to before — no poll key, no claim row, no code.

### Why the code closes the hole

The code is revealed **only on the click page** — the victim's Safari — and the
poller must present it. An attacker who holds the poll key never sees the
victim's click page, so cannot confirm. Security does **not** depend on user
vigilance (unlike "tap the matching number", where a rushed victim can approve
the attacker's prompt): the attacker simply lacks the secret. Brute force is
bounded to at most **3 / 10000** within the window by a **4-digit** code, a
**3-attempt** cap per claim, a **5-minute** confirm window, and a per-IP rate
limit — negligible.

## Consequences

- **The attempt cap is an atomic gate, not a stale read.** Consuming an attempt
  IS the gate: `confirm.post` first runs one conditional UPDATE —
  `SET confirm_attempts = confirm_attempts + 1 WHERE poll_key_hash = $1 AND
claimed_at IS NULL AND confirm_code_hash IS NOT NULL AND
confirm_expires_at > now() AND confirm_attempts < 3 RETURNING confirm_code_hash,
confirm_attempts` — and only then constant-time compares (`safeEqualHashes`) the
  returned hash. The row lock this UPDATE takes means at most 3 requests can ever
  obtain a hash to compare, even under N-way concurrency. A prior
  read-then-compare-then-increment (three pooled statements, no lock held across
  them) let N parallel requests all read `confirm_attempts = 0` and test a code
  before any increment committed — a TOCTOU that made the 4-digit code
  brute-forceable; the single conditional UPDATE closes it.
- **The mint is single-issue.** On a match, `confirm.post` claims + mints in one
  transaction: `UPDATE signin_claims SET claimed_at = now() WHERE
poll_key_hash = $1 AND confirm_code_hash = $2 AND claimed_at IS NULL AND
confirm_expires_at > now() RETURNING user_id`. Postgres row-locks the row, so a
  double-confirm race issues exactly one session; signing rides inside the
  transaction so a failure rolls the claim back for retry. The mint UPDATE does
  NOT re-check the cap — the request already legitimately consumed an in-cap
  attempt and matched, so concurrent wrong guesses filling the cap must not
  retroactively deny it.
- **No enumeration signal.** Poll returns `pending` / `confirm`; confirm returns
  `ready` / `invalid` / `expired`. None reads email or user existence, so none
  leaks who is registered. A random-key prober only ever gets `pending` /
  `expired`; `invalid` (wrong code, retry) is reachable only by a holder of a
  genuinely-armed claim, and reveals nothing beyond what its own poll already
  told it.
- **Two bearer secrets, both hashed at rest.** The poll key (256-bit, in the
  PWA's storage) and the code (shown once on the click page) are stored only as
  SHA-256 hashes. The code never appears in a URL, a log, or any poll/confirm
  response — only in the click-page body. Both endpoints are POST + `no-store`;
  the issued cookie is HTTPS-only off `local`; localStorage is cleared on
  success or expiry.
- **New sessions-growth site inherits the ADR-0005 sweep.** `confirm.post` is a
  second place sessions are created, so it carries the same lazy
  `DELETE WHERE expires_at < now()` sweep, fail-open, at the moment it mints.
  `signin_claims` gets the same lazy sweep as tokens (ADR-0002), on the
  magic-link write that creates claims.
- **Arm extends `expires_at` to cover the confirm window.** A late click makes
  `confirm_expires_at` (click + 5 min) outlive the outer `expires_at`
  (send + 15 min). Because the claim sweep is global (`DELETE WHERE
expires_at < now()`, not scoped to one key), it would delete a still-confirmable
  claim and strand the user with the correct code. The arm sets
  `expires_at = greatest(expires_at, confirm_expires_at)` (never shortening it),
  so the outer bound can never precede the confirm window and the sweep can only
  fire once the confirm window has also closed.
- **Same recorded exit as ADR-0002/0005:** when auth state moves to a store
  with native TTL (Redis), the claim table and all three lazy sweeps go
  together.
- **The PWA session reflects the PWA.** Confirm mints a fresh session with the
  PWA's own user-agent/IP rather than sharing Safari's callback session, so each
  jar's session carries its own audit trail and neither dangles on logout.
- **UX cost.** One code entry on the initiating device. The email link stays one
  tap; desktop/browser sign-in is unchanged; only the installed PWA sees the
  extra step, which is the only client that needs the cross-jar handoff.

## Follow-up: routing the installed PWA into the flow (VKB-70 QA)

The first cut scoped the whole poll/claim flow to `/login` and left the landing
hero on the plain magic-link path. On-device QA then found the gap: an installed
PWA opens at the manifest `start_url` `/`, which renders the marketing landing —
so the PWA signed in from the codeless hero (no poll key), `callback.get` saw no
`poll_key_hash`, and it redirected to `/me` while the code screen never appeared.
The root cause is an **entry-point mismatch**, not iOS and not caching.

Two client-only changes close it, with **no change to the server claim/confirm
logic and no manifest change** (`start_url` stays `/`):

- **Route standalone PWAs to `/login`.** The landing detects an installed
  standalone launch on mount and redirects to `/login` (the flow's home), so an
  installed PWA never signs in from the codeless hero. Client-only + `onMounted`
  so the prerendered landing is untouched during SSR/prerender; non-standalone
  desktop/web visitors fall straight through and see the landing exactly as
  before. `/login` resolves locale via cookie/Accept-Language (no_prefix), so
  `/`, `/fr`, `/uk` all hand off cleanly, and there is no loop — `/login` never
  redirects back to `/`.
- **Show the code field immediately for standalone.** On `/login`, an installed
  PWA renders the confirmation-code input together with the "open the link"
  message the moment the link is sent, instead of waiting for the poll to
  observe the click. The old late reveal (gated on the observed-armed flag) was
  jank: after clicking the link in Safari and returning, the user stared at
  "check your inbox" for seconds before the field appeared. The poll still runs;
  only the field's _visibility_ is decoupled from it. A code typed **before** the
  link is clicked hits an unarmed claim — the guarded UPDATE matches no row and
  returns `expired` with **no attempt consumed** — so the client shows a gentle
  "open the link in your email first" hint and keeps the field and poll alive,
  reserving the request-a-new-link message for a genuine post-arm expiry/lock.
  A correct code always mints regardless of the observed-armed flag, because
  `confirm.post` checks the DB directly.

`isStandalone()` — the single detector both the poll client (`useSigninPoll`)
and the landing redirect use — lives in `composables/usePwa.ts`, so the two can
never disagree about what "standalone" means.

## Duplicated-logic parity (PR-CHECKLIST)

The claim lifecycle spans four handlers; this is the reference:

| Step    | Handler           | Effect                                                              |
| ------- | ----------------- | ------------------------------------------------------------------- |
| bind    | `magic-link.post` | upsert `signin_claims` by `poll_key_hash`, unarmed                  |
| arm     | `callback.get`    | set `user_id` + hashed code + 5-min window; render code (fail-open) |
| report  | `poll.post`       | `confirm` if armed+valid, else `pending` — never the code           |
| confirm | `confirm.post`    | verify code, claim once, mint session; cap wrong attempts           |

Accepted deviations: a resend reuses the same poll key, so several tokens can
share one `poll_key_hash` (`magic_link_tokens.poll_key_hash` is non-unique);
the claim is upserted and the callback **re-arms** (overwrites the code, resets
the window) on `WHERE claimed_at IS NULL`, so clicking the latest of several
resent links shows a fresh, usable code. Arming is fail-open — if it throws,
the clicker is still signed into Safari and only the PWA handoff is lost.

**Verification — what runs where.** The flow needs a live Postgres and the
console email driver, which the CI e2e suite deliberately does not provision
(`e2e/*.spec.ts` cover only DB-free routes — landing, login form, offline, 404
— so CI needs no infra). The poll/claim/confirm tests are **local-only** and
are **not** part of the `bun run test:e2e` CI gate:

- **CI (`bun run test:e2e`, no infra):** the login/inbox screen renders and the
  send-button gating — the only poll/claim-adjacent surface that runs without a
  DB.
- **Local-only (`bun run test:poll-claim`, needs `infra:up` + local Postgres):**
  `e2e/local/` drives the full flow against a spawned dev server — the HTTP
  invariants (happy path: send → click reveals code → poll `confirm` → confirm
  → session in the PWA jar; **the regression that proves the fix:** an attacker
  holding the poll key but not the code gets `confirm` from poll, `invalid` then
  a lock from confirm, mints **no** session even with the correct code
  post-lock; **12 parallel wrong guesses cap `confirm_attempts` at 3, not 12,
  and mint nothing** — the atomic-gate regression, which fails on a
  read-then-increment; **a late click's confirm window survives the global
  sweep** and still confirms; confirm-window expiry → rejected;
  unknown/malformed → expired/400; desktop path unchanged), the Playwright
  cross-jar UX (code page → code input → `/me`, wrong-code retry, cold-start
  resume into the confirm step), and the entry-routing + code-field UX
  (`poll-entry.client.mjs`: a forced-standalone context redirects `/` and `/fr`
  to `/login`; `/login` shows the code field immediately on send; a premature
  submit before arming shows the gentle "open the link first" hint and does not
  strand — the real code still signs in; a non-standalone `/login` and the
  landing show the plain message with no code field and no redirect).
- **Needs a real iPhone (not automatable):** the actual iOS standalone-jar
  isolation and the on-device `navigator.standalone` launch that triggers the
  landing → `/login` redirect — confirmed only with the app added to the Home
  Screen.

The local suite is committed under `e2e/local/` and excluded from the Playwright
CI collection (`testIgnore`), so it never runs where there is no database.

## Alternatives rejected

- **Auto-arm + poll mint (no code)** — the naive handoff above; a
  session-fixation / login-CSRF hole (attacker-chosen key armed by a victim's
  click). Rejected outright.
- **"Tap the matching number" on the click page** — security would depend on the
  victim not approving an attacker-initiated prompt; code-on-click removes the
  human from the trust decision (the attacker lacks the secret regardless).
- **Universal links / app-intercepted click** — a pure PWA (no native app)
  cannot register them on iOS; the whole reason the link lands in Safari.
- **BroadcastChannel / storage events between Safari and the PWA** — the two
  jars are isolated by design; no shared channel exists.
- **Confirmation state on `magic_link_tokens`** — the callback deletes the token
  row (deletion _is_ consumption, ADR-0002), so the claim could not survive the
  click; a sibling table that outlives token consumption is required.
- **`GET` poll/confirm with the key in the query** — puts the bearer secret in
  the URL (logs, history) and lets the SW's `/api/*` NetworkFirst cache it; POST
  keeps it in the body and bypasses SW GET caching.
- **Attach the PWA to the callback's session** (claim stores `session_id`) —
  simpler, but the PWA session would carry Safari's user-agent/IP and dangle if
  that session were deleted; minting a fresh session per jar is cleaner.
- **Code input on the landing hero too** — the landing ships no i18n runtime
  (ADR-0006) and its own baked copy; scoping the whole poll/claim flow to
  `/login` (the landing hero sends a plain link) avoids a second copy system and
  never strands a PWA on a screen with no code input.
