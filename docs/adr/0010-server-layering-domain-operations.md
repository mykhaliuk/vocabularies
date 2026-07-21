# ADR-0010: server layering — every db access is a domain operation

- Status: Accepted
- Date: 2026-07-21
- Refs: VKB-76, VKB-64, CLAUDE.md "Server layering",
  `.claude/rules/feedback_no_dto_in_js.md`, `scripts/layering-check.js`

## Context

Until M12 every route was thin CRUD, so handlers mixed transport concerns
(auth guard, zod, response shaping) with raw Drizzle calls and nothing
hurt. VKB-64 brings real domain logic — entitlements (`can()`), the media
state machine, entry invariants — which must not live in HTTP handlers.
Two tempting fixes were rejected on the way here: a Repository layer
(Java cargo-cult, already banned by the no-DTO rule) and an "extract a
query function when it feels complex" convention (subjective — a
review-debate generator, not a rule).

## Decision

Three layers under `server/`: **transport** (`server/api`,
`server/middleware`), **domain** (`server/domain`), **infra**
(`server/utils`). The rule is binary: **transport never touches the db;
every db access is a domain operation** — a function in `server/domain/**`
named by business intent. A one-line `db.update` and a five-way join
follow the same rule; there is no complexity threshold to argue about.
Domain operations exist per product need, never as per-table CRUD kits.
A query needed identically by 2+ operations may move to a shared domain
helper (plain DRY, not a pattern). Resources are reached via lazy `use*()`
module singletons (`useDb()`), imported exactly where used; a context
object may carry only request-scoped state (`user`, `can()`, a transaction
handle) with a fixed shape. Enforcement is mechanical: `bun run
layering:check` fails CI on any db reference in transport outside the
legacy allowlist frozen in `scripts/layering-check.js`; the list only
shrinks, and new files are never added to it.

## Consequences

- Every route has one shape: guard → validate → domain call → project.
  The review question "is this query too complex to inline?" no longer
  exists.
- Thin operations cost a one-line function; accepted overhead for a
  machine-checkable invariant (same trade as the `can()` one-door rule).
- Eight pre-decision routes are grandfathered in the allowlist; they
  migrate opportunistically (when touched), not as a big-bang refactor.
  VKB-64 materializes `server/domain/` (entries, media, entitlements).
- Tree-shaking and cold-start stay exact: each Nitro route chunk traces
  only the `use*()` modules its domain operations import — no god context
  factory dragging every resource into every function.

## Alternatives rejected

- **Repository/DTO layer** — 1:1 table wrappers plus mappers; already
  banned (`feedback_no_dto_in_js.md`): Drizzle IS the data-access
  abstraction.
- **Extract-on-demand query functions** — "complex queries move out,
  simple ones stay inline" needs a subjective complexity call on every
  review; generates debate instead of preventing it.
- **God context (`createContext()` bundling all resources)** — a single
  factory statically importing db+storage+redis+mailer bloats every
  route's traced bundle and invites unstable object shapes; V8-hostile
  and tree-shake-opaque for zero DI benefit at this scale.
- **Do nothing until it hurts** — VKB-64 is the moment it starts hurting;
  retrofitting layering after entitlements ship costs more than landing
  the contract one PR earlier.
