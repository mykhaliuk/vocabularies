# ADR-0020: change-level planning lives in OpenSpec; specs accrete, never backfill

- Status: Accepted
- Date: 2026-08-20
- Refs: VKB-174, ADR-0010 (layering), ADR-0013 (capability graph),
  `openspec/config.yaml`, `CLAUDE.md`, `docs/capability-graph.md`

## Context

The project already carries five planning artifacts: Linear (execution state),
`ROADMAP.md` (the narrative arc), `docs/adr/` (decisions), `docs/GLOSSARY.md`
(vocabulary) and `docs/capability-graph.md` (a generated map of what the code
does today). Four of them are enforced or generated. Adding a sixth needs a
question it answers that none of the five do.

There is one: **what the system is supposed to do.** An ADR records why a choice
was made and is deliberately never rewritten. The capability graph is derived
from code, so by construction it describes what exists rather than what was
intended — it cannot disagree with the code, which is what makes it useless as
a specification. Linear tracks work, not behaviour. Nothing states intended
behaviour in a form a reviewer or a test can be checked against.

Phase 1 paid for that gap twice, in two different currencies:

- **Tests that pinned nothing.** Four passed while the system was broken — a
  warm font cache doing the work instead of the fix; a build that completed
  offline while emitting no font faces at all; every gate green while the page
  rendered in Times because an unquoted `format(woff2-variations)` silently
  dropped the whole `@font-face`; a race probe whose scenario made the race
  impossible. In each case the test's author had to invent what to assert.
- **Tickets whose premise was wrong.** VKB-113 proposed a `SKIP_MIGRATIONS`
  flag that cannot work, because a database-less build has no env config to set
  a flag in. VKB-137 was framed around a client seeing a 500 on a path that has
  no client; the real consequence was infinite QStash retry. Both were caught
  while reading code, after the branch was cut.

OpenSpec 1.9.0 was installed on 2026-08-19 and left uncommitted, so the
workflow existed on exactly one machine — the same failure shape as the
stabilization plan that once lived only in an ephemeral job directory.

## Decision

**Change-level planning lives in `openspec/`, committed, and is validated by
`bun run spec:check`.** The boundary against the existing artifacts is fixed:

| Artifact                   | Question                  | Written                         |
| -------------------------- | ------------------------- | ------------------------------- |
| `openspec/specs/`          | what it must do           | by hand, as changes land        |
| `docs/capability-graph.md` | what it does today        | generated                       |
| `docs/adr/`                | why we chose this         | by hand, dated, never rewritten |
| `docs/GLOSSARY.md`         | what we call it           | by hand                         |
| Linear                     | what to do, and its state | by hand                         |

Three consequences follow, and they are the actual decision:

1. **A change folder is required when the ticket's premise could be wrong** —
   it adds or changes product behaviour, or its acceptance criteria cannot be
   stated without reading code first. Not for dependency bumps, formatting,
   docs, or a mechanical refactor whose acceptance is "behaviour is identical".
2. **Specs accrete.** A capability gets a spec the first time a change touches
   it. There is no backfill project.
3. **Archive happens inside the feature PR**, so `specs/` advances atomically
   with the merge.

## Alternatives considered

**Require a change folder on every ticket.** Rejected: it turns the proposal
from a thinking tool into a form, and forms get filled in without thinking.
This is a solo project with one human reviewer; ceremony charged per PR will be
dropped within a week, and silently.

**Backfill `openspec/specs/` from the capability graph in one pass.** Rejected
outright — not deferred to a follow-up ticket, which would be the same decision
wearing a disguise. A spec written by someone who just read the code and needed
to pin its behaviour is a different artifact from a spec generated in a
documentation sprint; the second is prose nobody verified, which is the
documentation equivalent of a test that pins nothing. The graph stays useful as
a _seed_ when a spec is written — it names the routes, operations and columns a
capability spans — but it never substitutes for writing one.

**Extend ADRs to cover intended behaviour.** Rejected: an ADR is dated and
immutable by policy (`project_spec_historical_record`), which is exactly wrong
for a document that must track current intent. The two are complementary, not
substitutable.

## Consequences

- Every executor — local session, GitHub Actions agent, a fresh clone — sees
  the same workflow, because it is in the repository rather than on one laptop.
- `openspec/specs/` stays empty for a while. Accepted: a directory that fills as
  work lands is honest.
- **A known limit:** `openspec validate` sees only the changes that exist, so it
  cannot catch a change that should have had a folder and did not. That is held
  by the threshold above and by review, not by a check. If change folders stop
  being written, the evidence is that the threshold is still too wide — not
  that the tool failed.
- The CI step lands separately: the bot PAT cannot push a branch touching
  `.github/workflows/`, so `spec:check` ships as a script here and as a
  one-line workflow addition by the owner.
