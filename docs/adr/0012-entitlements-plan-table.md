# ADR-0012: entitlements are a plan table, resolved once and handed out as rights

- Status: Accepted
- Date: 2026-07-25
- Supersedes: ADR-0011 (the capability→roles map and its one-door convention;
  its two enforcement moments survive unchanged)
- Refs: VKB-91, `server/utils/entitlements.ts`,
  `server/domain/entitlements.ts`, `server/utils/auth.ts`

## Context

The compose picker is tier-dependent, so the client must know whether it may
offer video — but `GET /api/me` returned only the profile and ADR-0011's
one-door rule kept `plan` / `grants` server-side. Two defects sat beside that
gap: `plan` was unconstrained `text`, where a typo becomes a silent denial, and
`server/domain/media.ts` read the columns directly for the detached worker's
post-probe re-check, so the grep ADR-0011 depends on was already failing.

VKB-91 first proposed ordered tiers, a `user_grants` table with expiry and
audit columns, and per-tier limit resolution at three enforcement points. With
one capability, zero issued grants and identical limits across tiers, all three
were structure without behaviour. Cutting them left ADR-0011's
`capability → [roles]` map underneath — which answers "who has X" but cannot
produce "what does premium include" from any single place, and that is the
question the picker, a pricing screen and every limit tweak actually ask.

## Decision

**Entitlements are data, keyed by plan.**

```ts
const PLANS: Record<PlanTier, Entitlements>; // what a tier includes
const GRANTS: Record<GrantRole, Partial<Entitlements>>; // overrides
```

`entitlementsOf(user)` merges the plan row with the user's grants and returns a
plain `Entitlements`: booleans for features, numbers for limits. Consumers read
that object; nothing reads a tier.

- **`Record` over a full `Entitlements` is the enforcement.** Adding a tier or
  a field is a compile error until it is answered for every tier. This replaces
  ADR-0011's typecheck argument with a stronger one and **obviates tier
  ordering entirely** — adding a tier is one row that must answer everything,
  so it can no longer mean "touch every capability".
- **`admin` is an ordinary grant whose override is typed as the FULL shape.** A
  new entitlement field is therefore a compile error in admin's row. This was
  chosen over a superuser bypass: a bypass guarantees only that admin never
  _loses_ a right, while making silently _gaining_ one unavoidable — the day
  `deleteAnyAccount` ships, a bypass hands it over because nobody decided. The
  requirement was that an admin's rights never drift unnoticed; the type
  checker covers both directions, a bypass covers one.
- **Grant precedence is a `Record<GrantRole, number>` rank declared in code,
  not read from the column.** `users.grants` is a Postgres array whose order
  reflects how values were written, so merging in column order would let two
  users holding the same grants resolve differently. A rank Record rather than
  an ordered array for the same reason the other tables are Records: an array
  would let a newly added grant role be omitted and then dropped _silently_ by
  the merge, so a user holding it would behave like a user without it. An
  override may raise or lower a value; both are visible in the table.
  **Where the Record stops:** it enforces that every role _has_ a rank, not that
  the ranks _differ_, and `Array.prototype.sort` is stable — so a shared rank
  would silently restore the column dependence the rank exists to remove, and
  the order-independence test would not catch it for as long as the tied grants
  agree on every field. Distinctness is not expressible in the type, so
  `GRANT_RANK` is exported and a test pins it. The general rule this module
  follows: the type checker covers key presence, while relations _between_
  values are a test's job.
- **Asymmetric handling of values the tables do not know**, reachable only
  through an out-of-band `ALTER TYPE`: an unknown **plan throws**, because
  spreading a missing row yields a half object whose undefined limits reach the
  client; an unknown **grant is dropped**, because dropping it adds no rights
  and therefore fails closed.
- **No nullable limits.** Availability is the boolean; a `null` limit would
  encode the same fact twice and the two would drift. There is no "unlimited"
  case to represent yet.
- **`requireUser` returns rights, not the row.** It resolves entitlements from
  the row it already loads and returns `AuthUser`
  (`{ id, email, displayName, avatarKey, entitlements }`). The row dies inside
  the function. This **dissolves the one-door rule instead of policing it**: a
  convention saying "do not read these columns outside file X" exists only
  because the columns are reachable, and a rule kept by a growing allowlist is
  what quietly breaks two tickets later. `plan` / `grants` are now named in
  exactly one file — `server/domain/entitlements.ts`, whose `loadEntitlements`
  serves the one caller with no request to inherit from: the QStash worker.
- **`plan` and `grants` are Postgres enums** (`plan_tier`, `grant_role`), so an
  invalid value is a database error rather than a silent denial.
- **Tier changes mid-flight resolve at processing time and stand.** The worker
  calls `loadEntitlements(media.ownerId)` after the ffmpeg probe, so a plan that
  lapsed between the upload and the probe changes that media's outcome. No
  re-evaluation beyond the existing at-least-once semantics.

## Consequences

- Changing a limit or shipping a plan is a data change in one table; it was a
  code change in three files.
- The policy module is pure with one sibling import, so `bun test tests/unit`
  covers it with no database and no alias resolution. Order-independence and
  the no-shared-object property are pinned by tests.
- Enum trade-off (accepted): adding a value is trivial, renaming or removing
  one requires recreating the type. Plan names do change in real products.
- The enum conversion is a hand-finished migration — drizzle-kit emits neither
  the `USING` casts nor the default juggling Postgres needs on a populated
  table — and it is strict: an out-of-range value fails the migration rather
  than being silently repaired. `vercel-build` runs migrations, so such a value
  blocks the deploy. DDL is transactional, so there is no half-state. Preflight
  `SELECT DISTINCT plan` / `unnest(grants)` on every stage before merge.
- Limits still resolve to the same numbers for every plan. The mechanism to
  differentiate them is now in place; only the numbers are missing.

### Deferred, with the condition that revives each

| Deferred                                                        | Revive when                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_grants` table with `expires_at` / `granted_by` / `reason` | A time-boxed grant is actually issued (trial, temporary access)                                                                                                                                                                                                                                                                                                                                                           |
| Per-plan **duration** limits inside the pipeline                | A plan's numbers actually differ. The per-plan **byte** cap is already enforced in `mintUploadSlot` (413 `UPLOAD_TOO_LARGE`), since `slot.maxBytes` is reported from the plan and reporting a cap the server would not accept is contract drift. Duration is not knowable at mint time, so it still comes from the module constants inside `processMedia`; `loadEntitlements` already hands the worker the plan's numbers |
| A representation for "unlimited"                                | A plan has no cap on something                                                                                                                                                                                                                                                                                                                                                                                            |
| **CASL**                                                        | Authorization becomes conditional and per-resource — "may this subject act on _this_ row" — i.e. when sharing/following ships. Not for one boolean: today ownership is a `WHERE owner_id = ?`. Its client/server isomorphism is what would remove the hand-written projection then                                                                                                                                        |
| `capability_roles` table or a policy engine                     | Access must change without a deploy (unchanged from ADR-0011)                                                                                                                                                                                                                                                                                                                                                             |

**Stripe** is the future source of `plan`, not a replacement for this layer:
its Entitlements API is boolean-only, eventually consistent via webhooks, and
does not enforce anything inside the application. This layer is built in the
shape Stripe can feed.

## Alternatives rejected

- **`capability → [roles]` (ADR-0011)** — cannot answer "what does this plan
  include" from one place; it is this model inverted.
- **Ordered tiers with `admin` → premium-equivalent** — derives a hand-issued
  role's rights from a billing tier, so redefining the tier silently moves the
  admin's access. Found by building it.
- **A superuser bypass for `admin`** — see above; one-directional guarantee,
  and justified by the same hypothetical-future argument this ticket rejected
  for tiers.
- **`user_grants` table now / per-tier limit resolution now** — structure with
  no behaviour at zero grants and identical numbers.
- **Keeping the one-door grep as a CI check** — treats the symptom. Making the
  columns unreachable removes the thing being checked.
