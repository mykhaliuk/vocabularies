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

Three layers under `server/`: **transport** — every request-facing Nitro
surface (`server/api`, `server/routes`, `server/middleware`,
`server/plugins`) — **domain** (`server/domain`), **infra**
(`server/utils`). The rule is binary: **transport never touches the db;
every db access is a domain operation** — a function in `server/domain/**`
named by business intent. A one-line `db.update` and a five-way join
follow the same rule; there is no complexity threshold to argue about.
Domain operations exist per product need, never as per-table CRUD kits.
A query needed identically by 2+ operations may move to a shared domain
helper (plain DRY, not a pattern). Resources are reached via lazy `use*()`
module singletons (`useDb()`), imported exactly where used; a context
object may carry only request-scoped state (`user`, `can()`, a transaction
handle) with a fixed shape. This deliberately **narrows the
resource-injection sentence** of `feedback_no_dto_in_js.md` ("inject
resources as a context object"): in this codebase the Context pattern is
reserved for request scope, process resources come from `use*()`
singletons, and this ADR wins until the upstream rule (maintained outside
the repo, synced via `rules:sync`) is aligned. Enforcement is mechanical:
`bun run layering:check` fails CI on any db reference in transport outside
the legacy allowlist frozen in `scripts/layering-check.js`; the list only
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
- `server/utils/auth.ts` is the same legacy in infra clothing: the
  session lookup inside `requireUser` becomes a `resolveSession` domain
  operation when the auth routes migrate. The guard is lexical and only
  scans transport, so this transitive access is held by review until then.
- The lazy sweeps pinned by ADR-0002 (expired tokens, in
  `magic-link.post`) and ADR-0005 (expired sessions, in the auth
  callback) keep their behavior and timing; only their home moves into
  the corresponding domain operation when those routes migrate. This does
  not reverse either decision.
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

## Follow-up (2026-08-24, VKB-85 closed by VKB-90)

The migration this ADR planned is complete. The eight grandfathered
routes moved into domain operations (VKB-86, VKB-87, VKB-88, VKB-89),
`requireUser` resolves sessions through the `resolveSession` domain
operation so `server/utils/` carries no db access, and the emptied
`LEGACY_ALLOWLIST` machinery was deleted from `scripts/layering-check.js`
— the guard now fails unconditionally on any db reference in transport.
The allowlist and transitive-gap wording above describes the state at
decision time and is kept as the record of it.
