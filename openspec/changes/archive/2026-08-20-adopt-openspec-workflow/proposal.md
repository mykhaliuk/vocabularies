## Why

VKB-174. OpenSpec 1.9.0 was installed on 2026-08-19 and never committed. `openspec/`
and `.claude/commands/opsx/` exist only as untracked files in the owner's working
copy, `CLAUDE.md` does not mention OpenSpec once, `openspec/specs/` is empty, and
`openspec validate` runs nowhere.

That is worse than not adopting it. The owner's sessions follow a workflow that CI,
the GitHub `@claude` agent and every fresh session cannot see, so divergence shows up
as "this executor mysteriously skipped the process" rather than as an error. The
project has already paid for this shape once: the stabilization plan lived only in an
ephemeral job directory and had to be re-derived twice.

The gap it fills, and the Phase 1 evidence for it, are in ADR-0020 — no existing
artifact states **intended behaviour** in a form a reviewer or a test can be checked
against.

## What Changes

- Commit the installed tooling: `openspec/config.yaml`, the empty `specs/` and
  `changes/archive/` trees, and the `.claude/commands/opsx/` slash commands.
- State the contract in `CLAUDE.md`: which changes need a change folder and which do
  not, how the artifacts relate to Linear, ADRs and the capability graph, and what
  "done" means for a change.
- Add the `spec:check` and `spec:status` scripts, so the workflow is enforced by
  a check rather than by memory.
- Record the decision as ADR-0020, including the boundary against the artifacts the
  project already has.

## Capabilities

### New Capabilities

None. This change adds no product behaviour.

### Modified Capabilities

None. `skip_specs: true` is set in `.openspec.yaml`: this is tooling and
documentation, and inventing a requirement to satisfy validation is exactly what the
spec template warns against.

## Non-goals

- **Backfilling `openspec/specs/`.** Rejected outright, not deferred — see
  ADR-0020. Specs accrete as changes touch capabilities; `docs/capability-graph.md`
  seeds each one when it is written, and substitutes for none of them.
- **Converting existing ADRs into specs.** ADRs record decisions and stay decisions;
  specs record behaviour. The two coexist — see ADR-0020.
- **Retrofitting change folders onto merged work.** The workflow starts with the next
  ticket. A change folder written after the fact documents nothing that the PR does
  not already show.
- **Wiring the gate into `.github/workflows/ci.yml`.** The bot PAT cannot push a
  branch that touches `.github/workflows/`, so the CI step ships separately, by the
  owner. The `spec:check` script lands here so that step is a one-line addition.

## Impact

- New: `openspec/**`, `.claude/commands/opsx/**`, `docs/adr/0020-spec-driven-changes.md`.
- Modified: `CLAUDE.md` (new section, plus a pointer from the execution contract),
  `package.json` (two scripts).
- No source, schema or runtime behaviour is touched.
