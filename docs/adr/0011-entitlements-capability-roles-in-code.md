# ADR-0011: entitlements — capability→roles map in code, one door

- Status: Superseded by ADR-0012 — the capability→roles map became a plan
  table and the one-door rule was dissolved structurally. The two enforcement
  moments below (slot mint, post-probe re-check) survive unchanged.
- Date: 2026-07-18 (decided in VKB-64 planning; implemented 2026-07-23)
- Refs: VKB-64, `server/utils/entitlements.ts`, docs/GLOSSARY.md
  (plan, grant, role, capability)

## Context

Video upload is the first gated product right: free and essentials plans
do not get it, premium does — and hand-granted `vip`/`admin` users must
get it regardless of what they pay. Billing does not exist yet (plans are
set manually), so whatever model ships now must not paint the future
billing work into a corner, and must be reviewable without tracing role
checks across the codebase.

## Decision

**Each capability maps to the ROLES that receive it; a user's roles are
their plan plus their grants.** `server/utils/entitlements.ts` holds:

- `CAPABILITY_ROLES` — a plain frozen map, e.g.
  `videoUpload: ['vip', 'admin', 'premium']`.
- `can(user, capability)` — the only public entry; unknown capability →
  false.

**The map lives in code, not a table.** Access only changes when a
feature or plan ships — which is already a deploy; code is versioned,
reviewed, and typo-safe under typecheck. Recorded exit: when changing
access without a deploy becomes a real need, the map moves to a
`capability_roles(capability, roles text[])` table read inside `can()` —
consumers untouched.

**One-door rule (module contract):** nobody reads `user.plan` /
`user.grants` outside `can()` — reviewable with a grep for
`\.plan|\.grants`. Future beta cohorts become a per-user override table
inside `can()`; percentage rollouts become a deterministic hash inside
`can()`. Zero consumer changes either way.

**Enforcement in `server/domain/media.ts`, at two moments of the same
door.** The upload-slot mint (`mintUploadSlot`), which every slot —
entry-bound or standalone — passes through, rejects a DECLARED video
content type with 403 + `VIDEO_UPLOAD_FORBIDDEN`. Because mp4/m4a
containers carry audio and video alike, the declared type is not proof:
`processUploadedMedia` re-checks the capability against the PROBED kind
and fails the media (permanently — redeliveries re-run the check) when
actual video bytes arrive under an audio declaration. Both checks call
`can()`; the rest of the pipeline stays role-agnostic. The UI keeps the
video affordance visible as an upsell (VKB-67) — the server enforces
regardless.

## Consequences

- Known limitation (accepted): plan/grants ride on the session's user
  load, so a new grant applies on the next session read, not instantly.
- `users.plan` and `users.grants` are written only by billing (manually
  until billing exists); no API writes them.
- Adding a capability is one map entry plus one `can()` call at its
  enforcement point.

## Alternatives rejected

- **Role→capabilities direction** — the product question is "who gets
  this feature", not "what can this role do"; the chosen direction keeps
  one line per shipped feature.
- **Database-driven from day one** — a table with no writer UI is just
  code with worse review; the exit path is recorded and cheap.
- **Per-route plan checks** — scattering `user.plan === 'premium'`
  comparisons is exactly what the one-door rule exists to prevent.
