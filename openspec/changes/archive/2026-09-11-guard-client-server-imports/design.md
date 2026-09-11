## Context

See proposal.md — Why. What shapes the approach:

- `.github/workflows/ci.yml` lists every check as its own step
  (`run: bun run layering:check`, `run: bun run graph:check`, …). There is no
  aggregate script a new check could join.
- The agent PAT cannot push a branch that touches `.github/workflows/`; it
  lacks the `workflow` scope. So a new check that needs a new workflow step
  cannot be enforced by the same PR that adds it.
- `scripts/layering-check.js` is ~100 lines of walk-and-match with a comment
  block that states its contract and its known limits. It is the shape to
  follow, not to replace.
- The client imports are not hypothetical: `composables/useEntryPlayback.ts`
  spans four lines with `from` alone on the last one, so anything line-based
  would miss it.

## Goals / Non-Goals

**Goals:**

- The invariant is enforced by a check CI already runs, in the PR that
  introduces it.
- A failure names the file, line and specifier, so it is actionable without
  reading the script.
- It costs milliseconds, like the half it joins.

**Non-Goals:**

- See proposal.md — Non-goals for oxlint, transitive analysis and bundle
  assertions.
- Renaming `layering:check`. The command name is what CI invokes; changing it
  would need the workflow edit this design exists to avoid.

## Decisions

### D1 — Extend `layering:check` rather than add a script

The ticket asks for "its own `scripts/*.js`, wired into the CI check set like
`layering:check`". The second half of that is not available: wiring means a
new step in `ci.yml`, and this PR cannot push one. A new script would land
unenforced — which is exactly the state the ticket exists to end, reproduced
in the fix.

So the rule joins the check that is already wired. That is also the more
honest place for it. `layering:check` is the repo's module-boundary guard; it
enforced one direction because that is the direction ADR-0010 was written
about, not because the other direction belongs somewhere else. A boundary
with two sides and one guard was the gap.

_Alternative — a new script plus a follow-up ticket for the CI step:_ the
enforcement arrives whenever someone picks the ticket up, and until then the
repo has a check nobody runs. Rejected for the reason the ticket was filed.

_Alternative — ask the owner to push the workflow edit over SSH:_ possible,
and correct if extending were wrong on its merits. It is not.

### D2 — oxlint's `consistent-type-imports` cannot express this

The ticket asks the question, and the answer is no, for a reason worth
recording so it is not re-asked.

`consistent-type-imports` governs *how* an import that is only used as a type
gets written — it rewrites `import { Foo }` into `import type { Foo }` when
`Foo` is never used as a value. It says nothing about *what may be imported
from where*. A client file that genuinely wants a runtime value out of
`~/server/utils/storage` is writing a correct value import, the rule is
satisfied, and the AWS SDK is in the bundle.

The invariant here is a dependency rule, not a style rule. oxlint's config
here is also flat (`categories: correctness, suspicious`, no per-directory
overrides), so even a `no-restricted-imports` shaped rule would have to ban
the paths repo-wide, including for the server files that must import them.

### D3 — Match statements, not lines

The existing half is line-based and can be, because `useDb(` and a db
specifier both fit on one line. An import statement does not: the repo has one
spanning four lines with the specifier alone on the last. Line matching would
see `} from '~/server/utils/entry-view';` with no `type` in sight and either
miss every multi-line type import or fail all of them.

So the new half scans the file as one string for import/export statements and
decides per statement. Line numbers come from counting newlines before the
match, so failures still point at a line.

### D4 — What counts as a violation

A statement referring to a `server/` or `db/` module fails unless everything
it brings across is erased at compile time:

- `import type { X } from '~/server/…'` — fine.
- `import { type X, type Y } from '~/server/…'` — fine; inline modifiers erase
  the same way.
- `import { type X, y } from '~/server/…'` — fails, on `y`.
- `import '~/server/…'` — fails; a side-effect import is the whole module.
- `await import('~/server/…')` — fails; dynamic imports are values.
- `export { x } from '~/server/…'`, `export * from …` — fails; a re-export is
  a value re-export unless typed.

The specifier is matched on the path segment rather than on the `~/` alias, so
`~~/`, `@/` and a relative `../../server/…` are all caught — the same reason
the existing `DB_PATTERNS` match quoted substrings.

### D5 — A unit test, because the check is the deliverable

`tests/unit/layering-check.test.ts` exercises the classifier against each case
in D4. The repo already pairs `scripts/*` with `tests/unit/*` this way
(`check-commits.js` ↔ `check-commits.test.ts`), and a guard whose own logic is
untested is the thing this ticket is about.

To make that possible the classifier is exported rather than kept inside
`main()`; the script keeps its `#!/usr/bin/env node` entry point.

## Risks / Trade-offs

- **The guard is lexical, so a rename or a re-export chain slips past** → the
  same limit the existing half carries, and its header already says so out
  loud. The proposal lists a bundle assertion as the stronger successor.
- **`layering:check` now fails for two unrelated reasons** → the output labels
  which rule fired, and the alternative is a check nothing runs.
- **A future legitimate value import from `shared/` would have to be argued**
  → correct: today nothing in those roots needs one, and if something does,
  the conversation is the point of the guard.

## Migration Plan

None. The check passes on `dev` as it stands — all fifteen imports already
comply — so it lands green and only constrains what comes next.
