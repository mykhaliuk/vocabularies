# Architecture Decision Records

One-page records of decisions that are **hard to reverse, surprising, or the
result of a real trade-off**. Not every choice needs one — routine picks live
in code comments and PR descriptions. The test: would a cold agent session
(worktree, CI `@claude`) plausibly re-litigate this? If yes, record it.

Rules:

- Before proposing to change or reverse an architectural decision, read the
  ADRs. Disagreeing is fine — but the argument must engage the recorded
  reasoning, not rediscover the question.
- A new hard-to-reverse decision lands as an ADR **in the same PR** that
  implements it.
- Superseding: never edit a decision retroactively. Add a new ADR, mark the
  old one `Superseded by ADR-NNNN`.
- Keep it one page. Context → Decision → Consequences → Alternatives rejected.

Format: `NNNN-short-slug.md`, template in [0000-template.md](0000-template.md).

## Index

- [ADR-0001](0001-ds-manifest-triad.md) — design system authored in the
  browser; the exported manifest is the contract, CI checks are the coupling
- [ADR-0002](0002-lazy-token-cleanup.md) — expired magic-link tokens swept
  lazily on write, not by cron
- [ADR-0003](0003-offline-sw-injectmanifest.md) — PWA offline via
  `injectManifest` custom service worker, not `generateSW`
- [ADR-0004](0004-i18n-no-prefix-cookie-locale.md) — i18n `no_prefix`
  strategy: locale is cookie/header state, not part of the URL
- [ADR-0005](0005-lazy-session-cleanup.md) — expired sessions swept lazily
  on sign-in, mirroring the token sweep
- [ADR-0006](0006-per-locale-static-landing.md) — per-locale prerendered
  landings (/, /fr, /uk) with baked copy and an Accept-Language entry
  redirect
- [ADR-0007](0007-transactional-email-rendering.md) — transactional emails are
  hand-rolled inline-styled HTML, localized server-side (magic-link first)
- [ADR-0008](0008-pwa-poll-claim-signin.md) — installed PWAs sign in via a
  poll/claim handoff gated by a click-revealed confirmation code (closes a
  session-fixation hole), not the Safari link cookie
- [ADR-0009](0009-media-pipeline-upload-first.md) — upload-first media
  pipeline: originals stored as-is in a private bucket, async ffmpeg to
  720p derivatives (renumbered from a 0007 collision)
- [ADR-0010](0010-server-layering-domain-operations.md) — server layering:
  transport never touches the db; every db access is a domain operation,
  enforced by `layering:check`
- [ADR-0011](0011-entitlements-capability-roles-in-code.md) — entitlements:
  capability→roles map in code behind a single `can()` door; enforcement at
  the upload-slot mint (**superseded by ADR-0012**)
- [ADR-0012](0012-entitlements-plan-table.md) — entitlements are a plan table
  resolved once into rights: enum-backed plan/grants, `requireUser` hands back
  entitlements instead of the row, `admin` a full-shape grant override so its
  rights cannot drift unnoticed
- [ADR-0013](0013-capability-graph-derived-not-declared.md) — the UI ↔ API ↔
  domain ↔ entity map is derived from the source tree and committed, with
  `graph:check` failing CI when it drifts; never hand-maintained
- [ADR-0014](0014-authed-e2e-via-real-magic-link.md) — authed e2e mints its
  session through the real magic-link flow, read from a mirrored server log,
  in a second Playwright config; never a forged cookie or a test-only endpoint
- [ADR-0015](0015-pwa-update-prompt.md) — PWA updates are offered, not
  applied: the worker waits for a `SKIP_WAITING` message and a dismissible
  prompt does the asking, instead of `autoUpdate` reloading mid-session
- [ADR-0016](0016-edit-cancel-leaves-the-word-untouched.md) — an abandoned
  edit leaves the word untouched: the save uploads first and commits the row
  last, cancel closes only for that commit, and the discard copy switches
  once a clip is past the point of recall
